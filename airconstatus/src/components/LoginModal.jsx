import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Same internal password as roomstatus — login state is shared between apps.
const INTERNAL_PASSWORD = "crystal1268";

const LoginModal = ({ open, onClose, onLogin }) => {
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!nickname.trim()) {
      setError("กรุณากรอกชื่อเล่น");
      return;
    }
    if (password !== INTERNAL_PASSWORD) {
      setError("รหัสผ่านไม่ถูกต้อง");
      return;
    }

    onLogin(nickname.trim());
    setNickname("");
    setPassword("");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4 text-center text-[#15803D]">
              เข้าสู่ระบบ
            </h2>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setError("");
                }}
                placeholder="กรอกชื่อเล่น"
                className="w-full border rounded-lg p-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#15803D]"
                autoFocus
              />
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="รหัสผ่าน"
                className="w-full border rounded-lg p-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#15803D]"
              />
              {error && (
                <div className="text-red-600 text-sm mb-4 text-center">
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-gray-300 text-black py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#15803D] text-white py-2 rounded-lg hover:bg-[#166534] transition-colors"
                >
                  เข้าสู่ระบบ
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoginModal;
