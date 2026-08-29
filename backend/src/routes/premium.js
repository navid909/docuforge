import Stripe from 'stripe';

export default async function premiumRoutes(fastify, options) {
  const { prisma } = await import('../lib/prisma.js');

  fastify.post('/checkout', async (request, reply) => {
    const { plan, successUrl, cancelUrl } = request.body || {};
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
      fastify.log.error({ error, userId: user.id }, 'Stripe checkout error');
      return reply.code(402).send({
        success: false,
        error: 'Failed to create checkout session. Please try again.',
      });
    }
  });

  fastify.post('/portal', async (request, reply) => {
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
        return reply.code(404).send({ success: false, error: 'No active subscription found.' });
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
      fastify.log.error({ error, userId: request.user.id }, 'Billing portal error');
      return reply.send({
        success: false,
        error: 'Failed to open billing portal.',
      });
    }
  });

  fastify.get('/status', async (request, reply) => {
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
  });

  fastify.post('/cancel', async (request, reply) => {
    const { immediate } = request.body || {};
    const user = request.user;
    const subscription = await prisma.getUserSubscription(user.id);

    if (!subscription) {
      return reply.code(404).send({ success: false, message: 'No active subscription found.' });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isPremium: false, premiumUntil: null },
      });
      await prisma.updateSubscription(subscription.stripeSessionId, { status: 'canceled' });
      return reply.send({ success: true, message: 'Subscription canceled (staging mode).' });
    }

    try {
      const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });
      if (!immediate) {
        await stripe.subscriptions.update(subscription.stripeSessionId, {
          cancel_at_period_end: true,
        });
      }

      await prisma.updateSubscription(subscription.stripeSessionId, {
        status: immediate ? 'canceled' : 'canceling',
      });

      if (immediate) {
        await prisma.user.update({
          where: { id: user.id },
          data: { isPremium: false, premiumUntil: null },
        });
      }

      return reply.send({ success: true, message: immediate ? 'Subscription canceled immediately.' : 'Subscription will cancel at period end.' });
    } catch (error) {
      fastify.log.error({ error, userId: user.id }, 'Cancel subscription error');
      return reply.code(500).send({ success: false, message: 'Failed to cancel subscription.' });
    }
  });
}
