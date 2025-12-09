const mongoose = require('mongoose')
const dotenv = require('dotenv')
const Service = require('../../models/service.model')
const Review = require('../../models/user.model')
const User = require('../../models/user.model')
const { ERRORS, objectValidator, paginationHandler, getSearchQuery, getDateRangeQuery, ROLES, normalize, paginateResponse } = require('../../utils')
const response = require('../../utils/response')
const ResponseHandler = require('../../utils/response')

dotenv.config()

const createService = (async (req, res) => {
    try {

        let { body, decoded, file } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let payload = {
            ...body,
            user: decoded.id,
            image: file ? normalize(file.path) : null
        }

        let service = new Service(payload)

        await service.save()

        return res.status(200).send({
            success: true,
            message: "Service Successfully Saved",
            data: service
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getService = async (req, res) => {
    try {
        let { decoded, query } = req;
        let { page = 1, per_page = 10, search, from, to, sortBy, categories, provider_id } = query;

        page = parseInt(page);
        per_page = parseInt(per_page);

        let { limit, skip } = paginationHandler(page, per_page);

        let filter = {};
        let sort = { createdAt: -1 };
        let projection = { reviews: 0, user_favorite: 0 };

        if (search) filter.name = getSearchQuery(search);
        if (from || to) filter.createdAt = getDateRangeQuery(from, to);
        if (sortBy) sort = { [sortBy]: 1 };
        if (categories && categories.split(",").length > 0) {
            filter.category = { $in: categories.split(",").map(item => new mongoose.Types.ObjectId(item)) };
        }

        // Filter by provider's services
        if (provider_id) {
            const provider = await User.findById(provider_id).select('provider_services');

            if (!provider) {
                return ResponseHandler.error(res, "Provider not found", 404);
            }

            // Filter services to only include those in provider's provider_services array
            if (provider.provider_services && provider.provider_services.length > 0) {
                filter._id = { $in: provider.provider_services };
            } else {
                // Provider has no services assigned, return empty result
                return ResponseHandler.success(res, "Service listing retrieved successfully.", {
                    current_page: page,
                    data: [],
                    first_page_url: `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}?page=1`,
                    from: 0,
                    last_page: 0,
                    last_page_url: `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}?page=0`,
                    links: [],
                    next_page_url: null,
                    path: `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`,
                    per_page: per_page,
                    prev_page_url: null,
                    to: 0,
                    total: 0
                });
            }
        }

        // Build aggregation pipeline
        let pipeline = [
            { $match: filter },
            {
                $lookup: {
                    from: "categories",
                    localField: "category",
                    foreignField: "_id",
                    as: "category"
                }
            },
            { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } }
        ];

        if (decoded?.id) {
            pipeline.push(
                {
                    $lookup: {
                        from: "users",
                        let: { service_id: "$_id" },
                        pipeline: [
                            { $match: { _id: new mongoose.Types.ObjectId(decoded.id) } },
                            { $project: { _id: 0, is_favorite: { $in: ["$$service_id", "$favorite_services"] } } }
                        ],
                        as: "user_favorite"
                    }
                },
                { $addFields: { is_favorite: { $arrayElemAt: ["$user_favorite.is_favorite", 0] } } }
            );
        } else {
            pipeline.push({ $addFields: { is_favorite: false } });
        }

        pipeline.push(
            { $project: projection },
            { $sort: sort },
            { $skip: skip },
            { $limit: limit },
            {
                $addFields: {
                    image_url: {
                        $cond: {
                            if: { $regexMatch: { input: "$image", regex: /^http/ } },
                            then: "$image",
                            else: { $concat: [process.env.BASE_URL, "$image"] }
                        }
                    }
                }
            }
        );

        const services = await Service.aggregate(pipeline);
        const total = await Service.countDocuments(filter);

        // Use paginationResponse helper
        const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;
        const paginated = paginateResponse({
            page,
            per_page,
            total,
            baseUrl,
            data: services
        });

        return ResponseHandler.success(res, "Service listing retrieved successfully.", paginated);

    } catch (e) {
        console.log("Error Message :: ", e);
        return ResponseHandler.error(res, e.message, 400);
    }
};



const getServiceById = async (req, res) => {
    try {
        const { id } = req.params;

        const service = await Service.findById(id)
            .populate([{ path: "category", select: "name price" }])
            .lean({ virtuals: true });

        if (!service) {
            throw new Error(ERRORS.SERVICE_NOTEXIST)
        }

        return ResponseHandler.success(res, "Service retrieved successfully.", service);

    } catch (error) {
        console.error("Error Message :: ", error);
        return ResponseHandler.error(res, error.message, 400);
    }
};


const updateService = (async (req, res) => {
    try {
        const { body, params, file } = req;
        const { id } = params;

        // Prepare update payload
        const updatePayload = { ...body };

        // If a new image is uploaded, update the image field
        if (file) {
            updatePayload.image = normalize(file.path);
        }

        let service = await Service.findByIdAndUpdate(
            id,
            { $set: updatePayload },
            { new: true }
        );

        return ResponseHandler.success(res, "Service Updated Successfully", service);

    } catch (e) {
        console.log("Error Message :: ", e);
        return ResponseHandler.error(res, e.message, 400);
    }
});

const deleteService = (async (req, res) => {
    try {

        const { params } = req
        const { id } = params

        await Service.findByIdAndDelete(id)

        return ResponseHandler.success(res, "Service Deleted Successfully");

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
    }
})

const handleFavorite = (async (req, res) => {
    try {

        const { params, decoded } = req
        const { id } = params

        let user = await User.findById(decoded.id)

        if (!user) {
            throw new Error(ERRORS.USER_NOTEXIST)
        }

        let favorite_services = await user.favorite_services.map(service => service.toString())

        if (favorite_services.includes(id)) {
            favorite_services = favorite_services.filter(service => service !== id)
        } else {
            favorite_services.push(id)
        }

        user.favorite_services = favorite_services
        await user.save()

        return ResponseHandler.success(res, "Favorite Services Updated Successfully");

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
    }
})


module.exports = {
    createService,
    getService,
    getServiceById,
    updateService,
    deleteService,
    handleFavorite,
}