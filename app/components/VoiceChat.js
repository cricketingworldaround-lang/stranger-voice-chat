"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export default function VoiceChat() {
  const [status, setStatus] = useState("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const socketRef = useRef(null);
  const partnerIdRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pendingCandidates = useRef([]);
  const callTimerRef = useRef(null);
  const statusRef = useRef("idle");

  const setStatusBoth = (s) => {
    statusRef.current = s;
    setStatus(s);
  };

  useEffect(() => {
   const socket = io("https://stranger-voice-chat-tf2z.onrender.com");
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket.id);
    });

    socket.on("waiting", () => {
      setStatusBoth("waiting");
    });

    socket.on("matched", async ({ partnerId, initiator }) => {
      console.log("[Socket] Matched with:", partnerId);
      partnerIdRef.current = partnerId;
      setStatusBoth("connected");
      startCallTimer();
      await startWebRTC(initiator, partnerId);
    });

    socket.on("signal", async ({ from, data }) => {
      const pc = peerRef.current;
      if (!pc) return;

      if (data.type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        for (const c of pendingCandidates.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingCandidates.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("signal", { to: from, data: answer });
      } else if (data.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        for (const c of pendingCandidates.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingCandidates.current = [];
      } else if (data.candidate) {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(data));
        } else {
          pendingCandidates.current.push(data);
        }
      }
    });

    socket.on("partner-disconnected", () => {
      console.log("[Socket] Partner disconnected");
      cleanupPeer();
      stopCallTimer();
      partnerIdRef.current = null;
      setCallDuration(0);
      setStatusBoth("stranger-left");
    });

    socket.on("disconnect", () => {
      console.log("[Socket] Server disconnected");
      cleanupPeer();
      stopCallTimer();
      setStatusBoth("idle");
    });

    return () => {
      cleanupPeer();
      stopMicrophone();
      stopCallTimer();
      socket.disconnect();
    };
  }, []);

  // Call duration timer
  const startCallTimer = () => {
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
  };

  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const getMicrophone = async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
      },
      video: false,
    });
    localStreamRef.current = stream;
    return stream;
  };

  const startWebRTC = async (initiator, partnerId) => {
    cleanupPeer();
    pendingCandidates.current = [];

    let stream;
    try {
      stream = await getMicrophone();
    } catch (err) {
      console.error("[Mic] Error:", err);
      alert("Could not access microphone. Please allow mic access and try again.");
      return;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
    });
    peerRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      console.log("[WebRTC] Got remote track!");
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.volume = 1.0;
        remoteAudioRef.current.play().catch(console.error);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("signal", { to: partnerId, data: event.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[WebRTC] ICE:", pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        pc.restartIce();
      }
    };

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit("signal", { to: partnerId, data: offer });
    }
  };

  const cleanupPeer = () => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    pendingCandidates.current = [];
  };

  const stopMicrophone = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  };

  const findStranger = () => {
    socketRef.current?.emit("find-stranger");
    setStatusBoth("waiting");
  };

  const skipStranger = () => {
    cleanupPeer();
    stopCallTimer();
    setCallDuration(0);
    socketRef.current?.emit("skip");
    partnerIdRef.current = null;
    setTimeout(() => {
      socketRef.current?.emit("find-stranger");
      setStatusBoth("waiting");
    }, 300);
  };

  const endCall = () => {
    cleanupPeer();
    stopMicrophone();
    stopCallTimer();
    setCallDuration(0);
    socketRef.current?.emit("skip");
    partnerIdRef.current = null;
    setStatusBoth("idle");
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((m) => !m);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-700 opacity-10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-sm">

        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center w-32 h-32">
            {status === "connected" && (
              <div className="animate-pulse-ring absolute w-32 h-32 rounded-full bg-green-500 opacity-20" />
            )}
            {status === "waiting" && (
              <div className="animate-pulse-ring absolute w-32 h-32 rounded-full bg-yellow-500 opacity-20" />
            )}
            {status === "stranger-left" && (
              <div className="animate-pulse-ring absolute w-32 h-32 rounded-full bg-red-500 opacity-20" />
            )}
            <div className={`w-28 h-28 rounded-full flex items-center justify-center shadow-xl transition-colors duration-500
              ${status === "connected" ? "bg-green-700" :
                status === "waiting" ? "bg-yellow-700" :
                status === "stranger-left" ? "bg-red-900" : "bg-zinc-800"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-14 h-14 text-white opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>

          {status === "idle" && <p className="text-zinc-400 text-lg">Ready to connect</p>}
          {status === "waiting" && <p className="text-yellow-400 text-lg animate-blink">Looking for a stranger...</p>}
          {status === "connected" && <p className="text-green-400 text-lg">Connected — say hello! 👋</p>}
          {status === "stranger-left" && <p className="text-red-400 text-lg">Stranger disconnected</p>}
        </div>

        {/* Call duration */}
        {status === "connected" && (
          <div className="text-zinc-500 text-sm font-mono">
            {formatDuration(callDuration)}
          </div>
        )}

        {/* Mic controls */}
        {status === "connected" && (
          <div className="flex gap-3 w-full">
            <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-300 text-sm text-center">
              {isMuted ? "🔇 Muted" : "🎙️ Mic live"}
            </div>
            <button
              onClick={toggleMute}
              className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors
                ${isMuted ? "bg-red-700 hover:bg-red-600 text-white" : "bg-zinc-800 hover:bg-zinc-700 text-white"}`}
            >
              {isMuted ? "Unmute" : "Mute"}
            </button>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-3 w-full">
          {status === "idle" && (
            <button
              onClick={findStranger}
              className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all duration-150 text-white text-lg font-semibold shadow-xl"
            >
              Find a Stranger
            </button>
          )}

          {status === "waiting" && (
            <button
              onClick={endCall}
              className="w-full py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition-all duration-150 text-white text-lg font-semibold"
            >
              Cancel
            </button>
          )}

          {status === "connected" && (
            <>
              <button
                onClick={skipStranger}
                className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all duration-150 text-white text-lg font-semibold shadow-xl"
              >
                Next Stranger ⏭
              </button>
              <button
                onClick={endCall}
                className="w-full py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition-all duration-150 text-white text-base font-medium"
              >
                End Call
              </button>
            </>
          )}

          {status === "stranger-left" && (
            <>
              <button
                onClick={findStranger}
                className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all duration-150 text-white text-lg font-semibold shadow-xl"
              >
                Find New Stranger
              </button>
              <button
                onClick={endCall}
                className="w-full py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition-all duration-150 text-white text-base font-medium"
              >
                Go Home
              </button>
            </>
          )}
        </div>

        <button
          onClick={() => { endCall(); window.location.reload(); }}
          className="text-zinc-600 hover:text-zinc-400 text-sm transition-colors"
        >
          ← Back to home
        </button>
      </div>
    </main>
  );
}