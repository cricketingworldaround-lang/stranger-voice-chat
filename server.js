const { createServer } = require("http");
const { Server } = require("socket.io");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const PORT = process.env.PORT || 3000;

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  let waitingUser = null;
  const pairs = new Map();

  io.on("connection", (socket) => {
    console.log(`[+] Connected: ${socket.id}`);

    socket.on("find-stranger", () => {
      console.log(`[Queue] ${socket.id} looking for stranger`);
      if (pairs.has(socket.id)) return;

      if (waitingUser && waitingUser.socketId !== socket.id) {
        const partner = waitingUser;
        waitingUser = null;

        pairs.set(socket.id, partner.socketId);
        pairs.set(partner.socketId, socket.id);

        socket.emit("matched", { partnerId: partner.socketId, initiator: true });
        partner.socket.emit("matched", { partnerId: socket.id, initiator: false });

        console.log(`[Match] ${socket.id} <-> ${partner.socketId}`);
      } else {
        waitingUser = { socketId: socket.id, socket };
        socket.emit("waiting");
        console.log(`[Waiting] ${socket.id}`);
      }
    });

    socket.on("signal", ({ to, data }) => {
      io.to(to).emit("signal", { from: socket.id, data });
    });

    socket.on("skip", () => {
      handleDisconnectOrSkip(socket);
    });

    socket.on("disconnect", () => {
      console.log(`[-] Disconnected: ${socket.id}`);
      handleDisconnectOrSkip(socket);
    });

    function handleDisconnectOrSkip(socket) {
      if (waitingUser && waitingUser.socketId === socket.id) {
        waitingUser = null;
      }

      const partnerId = pairs.get(socket.id);
      if (partnerId) {
        pairs.delete(socket.id);
        pairs.delete(partnerId);
        io.to(partnerId).emit("partner-disconnected");
        console.log(`[Skip/DC] ${socket.id} left, notified ${partnerId}`);
      }
    }
  });

  httpServer.listen(PORT, () => {
    console.log(`\n🚀 Server running at http://localhost:${PORT}\n`);
  });
});