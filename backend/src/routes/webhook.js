import Stripe from 'stripe';

export default async function webhookRoutes(fastify, options) {
  const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const prisma = await import('../lib/prisma.js');

  fastify.post('/stripe', async (request, reply) => {
    if (!stripeSecret) {
      fastify.log.warn('STRIPE_WEBHOOK_SECRET not configured');
      return reply.code(400).send({ error: 'Stripe webhook not configured' });
    }

    const payload = request.rawBody;
    const signature = request.headers['stripe-signature'];

    if (!signature) {
      return reply.code(400).send({ error: 'Missing Stripe signature' });
    }

    let event;
    try {
      const stripe = new Stripe(stripeSecret, { apiVersion: '2024-12-18.acacia' });
      event = stripe.webhooks.constructEvent(payload, signature, stripeSecret);
    } catch (err) {
      fastify.log.error({ err, signature }, 'Stripe webhook signature verification failed');
      return reply.code(400).send({ error: `Webhook signature verification failed: ${err.message}` });
    }

    fastify.log.info({ event: event.type }, 'Stripe webhook received');
    try {
      await handleStripeEvent(event, prisma, fastify.log);
      return reply.send({ received: true });
    } catch (err) {
      fastify.log.error({ err, event: event.type }, 'Webhook processing failed');
      return reply.code(500).send({ error: 'Webhook processing failed' });
    }
  });

  async function handleStripeEvent(event, prisma, log) {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const apiKey = session.metadata?.api_key;
      if (!apiKey) {
        log.warn({ sessionId: session.id }, 'No api_key in checkout session metadata');
        return;
      }
      const validation = await prisma.validateApiKey(apiKey);
      if (!validation.valid || !validation.user) {
        log.warn({ apiKey }, 'Invalid API key in webhook');
        return;
      }
      const customerId = session.customer ? String(session.customer) : null;
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      if (session.subscription) {
        await prisma.createSubscription(validation.user.id, session.id, customerId, 'premium', periodEnd);
      } else {
        await prisma.createSubscription(validation.user.id, session.id, customerId, 'premium', periodEnd);
      }
      await prisma.activatePremium(validation.user.id, 30);
      log.info({ userId: validation.user.id, sessionId: session.id }, 'Premium activated via Stripe');
    } else if (event.type === 'invoice.payment.succeeded') {
      const invoice = event.data.object;
      const customerId = invoice.customer ? String(invoice.customer) : null;
      const subscription = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId, status: 'active' } });
      if (subscription) {
        const periodEnd = new Date(invoice.period_end * 1000);
        await prisma.updateSubscription(subscription.stripeSessionId, { currentPeriodEnd: periodEnd });
        const daysRemaining = Math.ceil((periodEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        if (daysRemaining > 0) {
          await prisma.activatePremium(subscription.userId, daysRemaining);
        }
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customerId = subscription.customer ? String(subscription.customer) : null;
      const subs = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
      if (subs) {
        await prisma.updateSubscription(subs.stripeSessionId, { status: 'canceled' });
        await prisma.user.update({ where: { id: subs.userId }, data: { isPremium: false, premiumUntil: null } });
        log.info({ userId: subs.userId }, 'Premium revoked via Stripe');
      }
    } else if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
      const customerId = subscription.customer ? String(subscription.customer) : null;
      const status = subscription.status;
      const subs = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
      if (subs) {
        await prisma.updateSubscription(subs.stripeSessionId, {
          status: status === 'active' ? 'active' : 'canceled',
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        });
        const user = await prisma.user.findUnique({ where: { id: subs.userId } });
        if (user) {
          if (status === 'active' && !user.isPremium) {
            await prisma.activatePremium(subs.userId, 30);
          } else if (status !== 'active' && user.isPremium) {
            await prisma.user.update({ where: { id: subs.userId }, data: { isPremium: false, premiumUntil: null } });
          }
        }
      }
    } else if (event.type === 'charge.refunded') {
      log.info({ chargeId: event.data.object.id }, 'Charge refunded');
    } else {
      log.debug({ eventType: event.type }, 'Unhandled Stripe event type');
    }
  }
}
