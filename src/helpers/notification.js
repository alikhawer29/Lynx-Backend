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

const sendStatusChangeNotification = async (user, newStatus, adminUser) => {
    try {
        const statusText = newStatus ? 'activated' : 'deactivated'
        const adminName = adminUser?.name || 'Administrator'

        const notification = {
            title: `Account ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`,
            body: `Your account has been ${statusText} by ${adminName}.`,
            data: {
                type: 'account_status_change',
                user_id: user._id.toString(),
                previous_status: !newStatus,
                new_status: newStatus,
                changed_by: adminUser?.id || 'system',
                changed_at: new Date().toISOString(),
                action: 'status_update'
            }
        }

        // Send notification using your existing helper
        await sendNotification(notification, user._id, true)

        console.log(`Status change notification sent to user ${user.email}`)

    } catch (error) {
        console.error('Error sending status change notification:', error)
        // Don't throw error - notification failure shouldn't break the main function
    }
}

module.exports = {
    sendNotification,
    sendBulkNotification,
    sendStatusChangeNotification
}