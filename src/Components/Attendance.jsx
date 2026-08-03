import { useState, useEffect } from "react";
import {
  User,
  LogIn,
  LogOut,
  Clock,
  Phone,
  ShieldCheck
} from "lucide-react";

const STORAGE_KEY = "attendanceUser";
const DEMO_OTP = "1234"; // hardcoded for now, per requirement

export default function Attendance() {
  // ── Session / auth state ──
  const [checkingSession, setCheckingSession] = useState(true);
  const [user, setUser] = useState(null); // { userId, username, mobileNumber, ... } once logged in

  const [authStep, setAuthStep] = useState("phone"); // "phone" | "otp"
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // ── Attendance state (unchanged) ──
  const [loggedIn, setLoggedIn] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // "login" | "logout" | null
  const [showHistory, setShowHistory] = useState(false);

  const history = [
    {
      date: "03 Aug 2026",
      userId: "EMP001",
      loginDateTime: "03 Aug 2026, 09:15 AM",
      logoutDateTime: "—"
    },
    {
      date: "02 Aug 2026",
      userId: "EMP001",
      loginDateTime: "02 Aug 2026, 09:05 AM",
      logoutDateTime: "02 Aug 2026, 06:20 PM"
    },
    {
      date: "01 Aug 2026",
      userId: "EMP001",
      loginDateTime: "01 Aug 2026, 09:10 AM",
      logoutDateTime: "01 Aug 2026, 06:05 PM"
    }
  ];

  // ── On mount: check localStorage for an existing user ──
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        // Corrupted value — treat as no session
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setCheckingSession(false);
  }, []);

  // ── Step 1: submit phone number, move to OTP step ──
  const handleSendOtp = (e) => {
    e.preventDefault();
    setAuthError("");

    if (!/^\d{10}$/.test(phoneNumber.trim())) {
      setAuthError("Enter a valid 10-digit mobile number.");
      return;
    }

    // OTP is fixed to 1234 for now — no real SMS is sent yet.
    setAuthStep("otp");
  };

  // ── Step 2: verify OTP, then look up user details and store in localStorage ──
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setAuthError("");

    if (otp.trim() !== DEMO_OTP) {
      setAuthError("Incorrect OTP. Please try again.");
      return;
    }

    setAuthLoading(true);
    try {
      // ── TEMPORARY MOCK — no real backend endpoint wired up yet ──
      // Swap this block for a real fetch() call once the user-lookup API
      // is available. Simulated with a short delay so the loading state
      // is visible, same as a real network call would behave.
      await new Promise((resolve) => setTimeout(resolve, 500));

      const userRecord = {
        userId: "EMP001",
        username: "John Doe",
        mobileNumber: phoneNumber.trim()
      };
      // ── END MOCK ──

      localStorage.setItem(STORAGE_KEY, JSON.stringify(userRecord));
      setUser(userRecord);
    } catch (err) {
      console.error("OTP verify / user fetch error:", err);
      setAuthError(err.message || "Could not verify OTP. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleConfirm = () => {
    if (confirmAction === "login") setLoggedIn(true);
    if (confirmAction === "logout") setLoggedIn(false);
    setConfirmAction(null);
  };

  // ── Still checking localStorage on first render ──
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // ── No stored user — show phone + OTP login gate ──
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-sm p-6">

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto flex items-center justify-center">
              {authStep === "phone" ? <Phone size={28} /> : <ShieldCheck size={28} />}
            </div>
            <h2 className="mt-4 font-bold text-lg">
              {authStep === "phone" ? "Login to Attendance" : "Verify OTP"}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {authStep === "phone"
                ? "Enter your mobile number to continue"
                : `OTP sent to ${phoneNumber}`}
            </p>
          </div>

          {authStep === "phone" ? (
            <form onSubmit={handleSendOtp}>
              <label className="text-sm text-gray-500 mb-1 block">Mobile Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full border rounded-lg p-3"
                maxLength={10}
              />

              {authError && (
                <p className="text-red-500 text-sm mt-2">{authError}</p>
              )}

              <button
                type="submit"
                className="mt-5 w-full bg-blue-600 text-white py-3 rounded-lg font-medium"
              >
                Send OTP
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <label className="text-sm text-gray-500 mb-1 block">Enter OTP</label>
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="4-digit OTP"
                className="w-full border rounded-lg p-3 tracking-widest text-center"
                maxLength={4}
              />

              {authError && (
                <p className="text-red-500 text-sm mt-2">{authError}</p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="mt-5 w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:opacity-60"
              >
                {authLoading ? "Verifying..." : "Verify & Continue"}
              </button>

              <button
                type="button"
                className="mt-3 w-full text-gray-500 text-sm py-2"
                onClick={() => {
                  setAuthStep("phone");
                  setOtp("");
                  setAuthError("");
                }}
              >
                Change mobile number
              </button>
            </form>
          )}

        </div>
      </div>
    );
  }

  // ── Logged in — main attendance view ──
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center">

      {/* Card: header, user, status, history toggle */}

      <div className="w-full max-w-sm bg-white relative">

        {/* Header */}

        <div className="flex items-center justify-center p-4 border-b">
          <h2 className="font-bold text-lg">Attendance</h2>
        </div>

        {/* User */}

        <div className="text-center mt-8">
          <div className="w-20 h-20 bg-blue-100 rounded-full mx-auto flex items-center justify-center">
            <User size={40} />
          </div>

          <h2 className="mt-3 font-semibold text-xl">
            {user.username}
          </h2>

          <p className="text-gray-500">
            {user.userId}
          </p>
        </div>

        {/* Status */}

        <div className="mx-5 mt-8 bg-gray-50 rounded-xl p-5 shadow-sm">

          <p className="text-gray-500">
            Current Status
          </p>

          <h2
            className={`text-xl font-bold mt-2 ${
              loggedIn ? "text-green-600" : "text-red-500"
            }`}
          >
            {loggedIn ? "Logged In" : "Logged Out"}
          </h2>

          {!loggedIn ? (
            <button
              onClick={() => setConfirmAction("login")}
              className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg flex justify-center gap-2"
            >
              <LogIn size={20} />
              Login
            </button>
          ) : (
            <button
              onClick={() => setConfirmAction("logout")}
              className="mt-6 w-full bg-red-500 text-white py-3 rounded-lg flex justify-center gap-2"
            >
              <LogOut size={20} />
              Logout
            </button>
          )}
        </div>

        {/* History toggle */}

        <div className="mx-5 mt-5 mb-8">
          <button
            onClick={() => setShowHistory((prev) => !prev)}
            className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg flex justify-center items-center gap-2 font-medium"
          >
            <Clock size={18} />
            {showHistory ? "Hide History" : "View History"}
          </button>
        </div>

      </div>

      {/* History table — not boxed into the card's max-w-sm; scrolls
          horizontally on its own so wide content can be reached by sliding
          the screen rather than being clipped or forced to wrap. */}

      {showHistory && (
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm border-t">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-left">
                <th className="py-2 px-3 font-medium whitespace-nowrap">Date</th>
                <th className="py-2 px-3 font-medium whitespace-nowrap">User ID</th>
                <th className="py-2 px-3 font-medium whitespace-nowrap">Login Date Time</th>
                <th className="py-2 px-3 font-medium whitespace-nowrap">Logout Date Time</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item, index) => (
                <tr
                  key={index}
                  className={index !== history.length - 1 ? "border-b" : ""}
                >
                  <td className="py-2 px-3 whitespace-nowrap">{item.date}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{item.userId}</td>
                  <td className="py-2 px-3 text-green-600 whitespace-nowrap">
                    {item.loginDateTime}
                  </td>
                  <td className="py-2 px-3 text-red-500 whitespace-nowrap">
                    {item.logoutDateTime}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm popup (shared for login + logout) */}

      {confirmAction && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">

          <div className="bg-white rounded-xl w-80 p-5">

            <h3 className="font-bold text-lg">
              {confirmAction === "login" ? "Confirm Login" : "Confirm Logout"}
            </h3>

            <p className="text-gray-500 text-sm mt-2">
              Are you sure you want to {confirmAction === "login" ? "login" : "logout"}?
            </p>

            <div className="flex gap-3 mt-6">
              <button
                className="flex-1 border rounded-lg py-2"
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </button>

              <button
                className={`flex-1 text-white rounded-lg py-2 ${
                  confirmAction === "login" ? "bg-blue-600" : "bg-red-500"
                }`}
                onClick={handleConfirm}
              >
                Confirm
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}