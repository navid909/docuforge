import { FastifyPluginAsyncTypebox } from '@fastify/typebox';
import { Type } from '@fastify/typebox';

export const premiumRoutes = FastifyPluginAsyncTypebox({
  async fastify({ reply, log }) {
    const prisma = await import('../lib/prisma.js');
    const Stripe = (await import('stripe')).default;

    // POST /premium/checkout
    fastify.post('/checkout', {
      schema: {
        body: Type.Object({
          plan: Type.Union([Type.Literal('premium'), Type.Literal('pro')]),
          successUrl: Type.Optional(Type.String()),
          cancelUrl: Type.Optional(Type.String()),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            checkoutUrl: Type.Optional(Type.String()),
            sessionId: Type.Optional(Type.String()),
            status: Type.String(),
            message: Type.Optional(Type.String()),
          }),
          401: Type.Object({ error: Type.String() }),
          402: Type.Object({ error: Type.String() }),
        },
      },
      handler: async (request, reply) => {
        const { plan, successUrl, cancelUrl } = request.body;
        const user = request.user;

        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
          return reply.send({
            success: true,
            status: 'staging',
            message: 'Staging mode: premium will be activated after Stripe integration.',
            sessionId: `staging_${user.id}`,
          });
        }

        try {
          const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

          const existingSub = await prisma.getUserSubscription(user.id);
          if (existingSub && existingSub.status === 'active') {
            return reply.send({
              success: false,
              status: 'already_active',
              message: 'You already have an active premium subscription.',
            });
          }

          if (existingSub && existingSub.status !== 'canceled') {
            return reply.send({
              success: false,
              status: 'pending',
              message: 'Your subscription is still processing. Please wait.',
            });
          }

          const priceId = plan === 'pro' ? process.env.STRIPE_PRO_PRICE_ID : process.env.STRIPE_PREMIUM_PRICE_ID;
          const finalPriceId = priceId || process.env.STRIPE_PREMIUM_PRICE_ID;

          const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
          const finalSuccessUrl = successUrl || `${baseUrl}/premium?success=true`;
          const finalCancelUrl = cancelUrl || `${baseUrl}/premium?canceled=true`;

          const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: finalPriceId, quantity: 1 }],
            success_url: finalSuccessUrl,
            cancel_url: finalCancelUrl,
            customer_email: user.email,
            metadata: {
              api_key: request.apiKey,
              userId: user.id,
            },
            subscription_data: {
              metadata: {
                userId: user.id,
                api_key: request.apiKey,
              },
            },
          });

          return reply.send({
            success: true,
            checkoutUrl: session.url,
            sessionId: session.id,
            status: 'pending',
          });
        } catch (error) {
          log.error({ error, userId: user.id }, 'Stripe checkout error');
          return reply.code(402).send({
            success: false,
            error: 'Failed to create checkout session. Please try again.',
          });
        }
      },
    });

    // POST /premium/portal (billing portal)
    fastify.post('/portal', {
      schema: {
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            url: Type.Optional(Type.String()),
            error: Type.Optional(Type.String()),
          }),
          401: Type.Object({ error: Type.String() }),
          404: Type.Object({ error: Type.String() }),
        },
      },
      handler: async (request, reply) => {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
          return reply.send({
            success: false,
            error: 'Billing portal not available in staging mode.',
          });
        }

        try {
          const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });
          const subscription = await prisma.getUserSubscription(request.user.id);

          if (!subscription) {
            return reply.code(404).send({
              success: false,
              error: 'No active subscription found.',
            });
          }

          const portalSession = await stripe.billingPortal.sessions.create({
            customer: subscription.stripeCustomerId,
            return_url: `${process.env.BASE_URL || 'http://localhost:3000'}/premium`,
          });

          return reply.send({
            success: true,
            url: portalSession.url,
          });
        } catch (error) {
          log.error({ error, userId: request.user.id }, 'Billing portal error');
          return reply.send({
            success: false,
            error: 'Failed to open billing portal.',
          });
        }
      },
    });

    // GET /premium/status
    fastify.get('/status', {
      preHandler: [],
      handler: async (request, reply) => {
        const user = request.user;
        const subscription = await prisma.getUserSubscription(user.id);

        return {
          isPremium: user.isPremium,
          premiumUntil: user.premiumUntil?.toISOString() || null,
          subscription: subscription ? {
            id: subscription.id,
            plan: subscription.plan,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          } : null,
        };
      },
    });

    // POST /premium/cancel (request cancellation)
    fastify.post('/cancel', {
      schema: {
        body: Type.Object({
          immediate: Type.Optional(Type.Boolean({ default: false })),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            message: Type.String(),
          }),
          401: Type.Object({ error: Type.String() }),
          404: Type.Object({ error: Type.String() }),
        },
      },
      handler: async (request, reply) => {
        const user = request.user;
        const subscription = await prisma.getUserSubscription(user.id);

        if (!subscription) {
          return reply.code(404).send({ success: false, message: 'No active subscription found.' });
        }

        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
          await prisma.prisma.user.update({
            where: { id: user.id },
            data: { isPremium: false, premiumUntil: null },
          });
          await prisma.updateSubscription(subscription.stripeSessionId, { status: 'canceled' });
          return reply.send({ success: true, message: 'Subscription canceled (staging mode).' });
        }

        try {
          const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });
          const cancelAtPeriodEnd = request.body.immediate ? false :
            await stripe.subscriptions.update(subscription.stripeSessionId, {
              cancel_at_period_end: true,
            });

          await prisma.updateSubscription(subscription.stripeSessionId, {
            status: request.body.immediate ? 'canceled' : 'canceling',
          });

          if (request.body.immediate) {
            await prisma.prisma.user.update({
              where: { id: user.id },
              data: { isPremium: false, premiumUntil: null },
            });
          }

          return reply.send({ success: true, message: request.body.immediate ? 'Subscription canceled immediately.' : 'Subscription will cancel at period end.' });
        } catch (error) {
          log.error({ error, userId: user.id }, 'Cancel subscription error');
          return reply.code(500).send({ success: false, message: 'Failed to cancel subscription.' });
        }
      },
    });
  },
});
