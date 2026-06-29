// Single holder for the Socket.io server instance
// Set once during server startup (server.js), then imported by any REST controller that needs to emit events without a circular dependency.

let _io = null;

export const setIO = (io) => {
  _io = io;
};

export const getIO = () => _io;
