const Content = require('../../models/content.model')
const { ERRORS, objectValidator, paginationHandler, getSearchQuery, getDateRangeQuery, ROLES, CONTENT_TYPES, normalize, paginateResponse } = require('../../utils')
const response = require('../../utils/response')

const createContent = (async (req, res) => {
    try {

        let { body, files } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let payload = {
            ...body
        }

        const media = files?.media?.[0] || null
        const media_thumbnail = files?.media_thumbnail?.[0] || null

        if (media) {
            payload.media = normalize(media.path)
            payload.media_thumbnail = media_thumbnail ? normalize(media_thumbnail.path) : null
            payload.media_type = payload.type === CONTENT_TYPES.ARTICLE ? "image" : "video"
        }

        let content = new Content(payload)

        await content.save()

        return res.status(200).send({
            success: true,
            message: "Content Successfully Saved",
            data: content
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getContent = async (req, res) => {
    try {
        let { role } = req.decoded;
        let { page = 1, per_page = 10, search, from, to, sortBy, active, type } = req.query;

        let { limit, skip } = paginationHandler(page, per_page);

        let filter = {};
        let sort = {};

        // Search
        if (search) {
            filter.title = getSearchQuery(search);
        }


        // Active query param
        if (req.query.hasOwnProperty("active")) {
            filter.active = active;
        }

        // Type filter
        if (type) {
            filter.type = type;
        }

        // Date range filter
        if (from || to) {
            filter.createdAt = getDateRangeQuery(from, to);
        }

        // Sorting
        sort = sortBy ? { [sortBy]: 1 } : { createdAt: -1 };

        // Fetch data
        let contents = await Content.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();

        let total = await Content.countDocuments(filter);

        // Build base URL for pagination links
        const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;

        // Paginate response
        let paginated = paginateResponse({
            page,
            per_page,
            total,
            baseUrl,
            data: contents
        });

        return res.json(response.success("Content listing retrieved successfully", paginated));
    } catch (e) {
        console.log("Error Message :: ", e);
        return res.json(response.error(e.message, 400, "Content Listing"));
    }
};


const getContentById = (async (req, res) => {
    try {

        let { id } = req.params

        let content = await Content.findById(id).lean({ virtuals: true })

        if (content?.type === CONTENT_TYPES.VIDEO) {

            const similar_content = await Content.find({
                _id: { $ne: content._id },
                type: content.type,
                active: true
            })
                .limit(5)
                .lean({ virtuals: true })

            content.similar_content = similar_content

        }

        return res.json(response.success("Content retrieved successfully", content));

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.json(response.error(e.message, 400, "Content retrieval"));
    }
})

const updateContent = (async (req, res) => {
    try {

        const { body, params } = req
        const { id } = params

        let content = await Content.findByIdAndUpdate(id, { $set: body }, { new: true })

        return res.status(200).send({
            success: true,
            message: "Content Updated Successfully",
            data: content
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const deleteContent = (async (req, res) => {
    try {

        const { params } = req
        const { id } = params

        let content = await Content.findById(id)
        await content.trash()

        return res.status(200).send({
            success: true,
            message: "Content Deleted Successfully",
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

module.exports = {
    createContent,
    getContent,
    getContentById,
    updateContent,
    deleteContent
}