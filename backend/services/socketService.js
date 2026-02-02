const { Server } = require('socket.io');
const logger = require('../utils/logger');

let io = null;

/**
 * 初始化 Socket.io
 * @param {import('http').Server} server HTTP 服务器实例
 */
function init(server) {
  io = new Server(server, {
    cors: {
      origin: '*', // 开发环境下允许所有，生产环境应根据需求配置
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    logger.info(`[Socket] Client connected: ${socket.id}`);

    // 允许客户端加入特定的房间，例如按照 userId 或 resumeId 订阅
    socket.on('subscribe', (room) => {
      socket.join(room);
      logger.info(`[Socket] Client ${socket.id} joined room: ${room}`);
    });

    socket.on('unsubscribe', (room) => {
      socket.leave(room);
      logger.info(`[Socket] Client ${socket.id} left room: ${room}`);
    });

    socket.on('disconnect', () => {
      logger.info(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * 发送消息到指定房间
 * @param {string} room 房间名 (例如 resume_123)
 * @param {string} event 事件名
 * @param {any} data 数据
 */
function emitToRoom(room, event, data) {
  if (io) {
    io.to(room).emit(event, data);
    logger.info(`[Socket] Emitted ${event} to room ${room}`);
  } else {
    logger.warn('[Socket] IO not initialized, cannot emit');
  }
}

/**
 * 发送消息到所有连接的客户端
 * @param {string} event 事件名
 * @param {any} data 数据
 */
function emitToAll(event, data) {
  if (io) {
    io.emit(event, data);
    logger.info(`[Socket] Emitted ${event} to all clients`);
  } else {
    logger.warn('[Socket] IO not initialized, cannot emit');
  }
}

module.exports = {
  init,
  emitToRoom,
  emitToAll,
  getIO: () => io
};
