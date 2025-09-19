const socketController = (socket, io) => {

    socket.on('join', (payload) => {

        let { conversation } = payload
        console.log(`Joining room :: ${conversation}`)
        socket.join(conversation);

    });

    socket.on('message', async (payload) => {

        console.log(`Received message from ${socket.id}`);

        let roomName = payload.conversation

        let data = {
            conversation: payload.conversation,
            sender: socket.user_id,
            message: payload.message
        }

        io.to(roomName).emit('message', {
            ...data,
            sender: {
                _id: socket.user_id
            },
            id: socket.id,
            createdAt: new Date()
        });

    });

}

module.exports = socketController