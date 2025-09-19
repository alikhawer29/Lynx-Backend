const Notification = require('../models/notification.model')
const admin = require('../configs/firebase')
const User = require('../models/user.model')

const sendNotification = (async (notification, id, savable = true) => {

    let user = await User.findById(id).lean()

    if (savable) {

        let notifications = new Notification({
            notification,
            recipients: [id]
        })

        await notifications.save()

    }

    if (user?.device_ids?.length > 0) {
        return await admin.messaging().sendEachForMulticast({
            notification: {
                title: notification.title,
                body: notification.body
            },
            data: notification?.data ?? {},
            tokens: user?.device_ids
        })
    }

})

const sendBulkNotification = (async (notification, ids = [], savable = true) => {

    let users = await User.find({ _id: { $in: ids } }).lean()
    let tokens = []
    users.forEach((item) => {
        item.device_ids.forEach(token => {
            tokens.push(token)
        })
    })

    if (savable) {

        let notifications = new Notification({
            notification,
            recipients: ids
        })

        await notifications.save()

    }

    if (tokens?.length > 0) {
        return await admin.messaging().sendEachForMulticast({ notification, tokens })
    }

})

module.exports = {
    sendNotification,
    sendBulkNotification
}