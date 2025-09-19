const { normalize, join } = require("path")
const fs = require("fs");
const User = require("../models/user.model")
const Category = require("../models/category.model")
const { ROLES } = require("../utils");
const { getTotalSubscriptionRevenue } = require("../helpers/stripe");

const upload = (async (req, res) => {
    try {

        if (!req.file) {
            throw new Error("No File Uploaded")
        }

        let { path } = req.file

        path = normalize(path)

        return res.status(200).send({
            success: true,
            data: {
                path
            }
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getData = async (_, res) => {
    try {

        let categories = await Category.find({ active: true }).select("name").lean()
        categories = categories.map(item => ({ label: item.name, value: item._id }))

        let data = {
            categories
        }

        return res.status(200).send({
            success: true,
            data,
        })

    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};

const getContent = async (req, res) => {
    try {

        let data = {
            about_us: "https://",
            privacy_policy: "https://",
            terms: "https://"
        };

        return res.status(200).send({
            success: true,
            data,
        });

    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};

module.exports = {
    upload,
    getData,
    getContent,
}