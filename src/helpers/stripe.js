const dotenv = require('dotenv')
const User = require("../models/user.model");
const { sendNotification } = require('./notification');

dotenv.config()

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const webhook = async (req, res) => {
    let event;

    try {
        const sig = req.headers["stripe-signature"];
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_KEY);
    } catch (err) {
        console.error("⚠️ Webhook signature verification failed.", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "invoice.paid") {
        const invoice = event.data.object;
        let user = await User.findOne({ stripe_customer_id: invoice?.customer })
        console.log("✅ Invoice Paid: user", user);
        sendNotification({ title: "Subscription Success", body: "Success", data: { type: "subscription_success" } }, user?._id, false)
    }

    res.json({ received: true });
}

const createProduct = async (name, description, prices = [], metadata) => {
    try {

        const product = await stripe.products.create({ name, description, metadata });
        let p = []

        for (let index = 0; index < prices.length; index++) {

            const element = prices[index];

            const price = await stripe.prices.create({
                product: product.id,
                unit_amount: Math.round(element.amount * 100),
                currency: 'usd',
                recurring: { interval: element.interval },
            });

            p.push(price)

        }

        return { product, prices: p };

    } catch (error) {
        throw error;
    }
};

const createCustomer = async (email, name) => {
    try {
        const customer = await stripe.customers.create({ email, name });
        return customer.id;
    } catch (error) {
        throw error;
    }
};

const createSubscription = async (id, price_id) => {
    try {

        let customer_id = null;

        const user = await User.findById(id)

        if (user?.stripe_customer_id && user?.stripe_customer_id !== null) {
            customer_id = user.stripe_customer_id
        } else {
            customer_id = await createCustomer(user?.email, user?.name)
            user.stripe_customer_id = customer_id
            await user.save()
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: price_id,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            metadata: {
                user_id: user?._id?.toString(),
                user_name: user?.name,
            },
            customer: customer_id,
            success_url: `https://projectstagingzone.com/success`,
            cancel_url: `https://projectstagingzone.com/cancel`,
        });

        return session.url;

    } catch (error) {
        throw error;
    }
};

const getCurrentSubscription = async (id) => {
    try {

        let user = await User.findById(id)

        if (user && user?.stripe_customer_id) {
            const subscriptions = await stripe.subscriptions.list({ customer: user?.stripe_customer_id, status: 'active' });
            return subscriptions.data[0] || null;
        }

        return null

    } catch (error) {
        throw error;
    }
};

const getAllPaymentLogs = async () => {
    try {

        const subscriptions = (
            await stripe.subscriptions.list({
                expand: ['data.items.data.price', 'data.latest_invoice']
            })
        ).data

        const productIds = new Set()
        const customerIds = new Set()

        subscriptions.forEach(sub => {
            const price = sub.items.data[0]?.price
            if (price?.product) productIds.add(price.product)
            if (sub.customer) customerIds.add(sub.customer)
        })

        const productsMap = {}
        await Promise.all(
            Array.from(productIds).map(async productId => {
                const product = await stripe.products.retrieve(productId)
                productsMap[productId] = product.name
            })
        )

        const users = await User.find({
            stripe_customer_id: { $in: Array.from(customerIds) }
        })
            .select('name email picture _id stripe_customer_id')
            .lean()

        const usersMap = {}
        users.forEach(user => {
            usersMap[user.stripe_customer_id] = user
        })

        return subscriptions.map(sub => {

            const price = sub.items.data[0]?.price

            return {
                subscription_id: sub.id,
                active: sub.status === 'active',
                customer_id: sub.customer,
                user: usersMap[sub.customer] || null,
                amount: price?.unit_amount / 100,
                currency: sub.currency.toUpperCase(),
                interval: price?.recurring?.interval
                    ? price.recurring.interval.charAt(0).toUpperCase() +
                    price.recurring.interval.slice(1) + 'ly'
                    : null,
                start_date: new Date(sub.start_date * 1000).toISOString(),
                current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
                current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
                invoice_link: sub.latest_invoice?.hosted_invoice_url || null,
                package_name: price?.product ? productsMap[price.product] : null
            }
        })


    } catch (error) {
        throw error;
    }
};

const getUserPaymentLogs = async (id) => {
    try {

        let user = await User.findById(id)

        if (user && user?.stripe_customer_id) {
            return (await stripe.subscriptions.list({ customer: user?.stripe_customer_id })).data;
        }

        return []

    } catch (error) {
        throw error;
    }
};

const getAllProductsWithPrices = async () => {
    try {

        const products = await stripe.products.list();
        const prices = await stripe.prices.list();
        return products.data.map(product => ({
            ...product,
            prices: prices.data.filter(price => price.product === product.id),
        }));

    } catch (error) {
        throw error;
    }
};

const getProductWithPrices = async (id) => {
    try {

        const product = await stripe.products.retrieve(id);
        const prices = await stripe.prices.list({ product: id });
        return {
            ...product,
            prices: prices.data,
        }

    } catch (error) {
        throw error;
    }
};

const updateProduct = async (id, payload) => {
    try {

        let product = await stripe.products.update(id, payload)

        return product

    } catch (error) {
        throw error;
    }
};

const getTotalSubscriptionRevenue = async () => {

    try {
        const subscriptions = (
            await stripe.subscriptions.list({
                expand: ['data.items.data.price', 'data.latest_invoice']
            })
        ).data;

        let total = 0;

        subscriptions.forEach(sub => {

            const price = sub.items.data[0]?.price;
            const amount = price?.unit_amount / 100 || 0;

            if (sub.status === 'active') {
                total += amount;
            }
        });

        return total

    } catch (error) {
        throw error;
    }
}

module.exports = {
    webhook,
    createProduct,
    createCustomer,
    createSubscription,
    getCurrentSubscription,
    getAllPaymentLogs,
    getUserPaymentLogs,
    getAllProductsWithPrices,
    getProductWithPrices,
    updateProduct,
    getTotalSubscriptionRevenue
};
