const dotenv = require('dotenv');
const Payment = require('../../models/payment.model');
const response = require('../../utils/response');

dotenv.config();

// ============================
// Get All Payments (Admin)
// ============================
const getAllPayments = async (req, res) => {
    try {
        const { page = 1, per_page = 10, payment_status } = req.query;

        const options = {
            skip: (page - 1) * per_page,
            limit: parseInt(per_page),
        };

        let filter = {};

        if (payment_status) {
            filter.payment_status = payment_status;
        }

        const payments = await Payment.find(filter, {}, options)
            .populate('booking_id')
            .populate('user_id', 'first_name last_name email')
            .sort({ createdAt: -1 });

        const total = await Payment.countDocuments(filter);

        return res.json(response.success("Payments retrieved successfully", payments));

    } catch (e) {
        console.log('Error Message :: ', e);
        return res.json(response.error(e.message, 400, "Payment Retrieval"));
    }
};

module.exports = {
    getAllPayments,
};

