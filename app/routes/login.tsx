// ~/routes/login.tsx

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { useLogin } from "~/hooks/useLogin";
import { useVerifyLogin } from "~/hooks/useVerifyLogin";
import { useSession } from "~/context/SessionContext";
import FloatingLabelInput from "~/compoments/Floatinglabelinpunt";
import { useUserDetails } from "~/hooks/useUserDetails";
import { usePaymentMethods } from "~/hooks/usePaymentMethods";

export const clientLoader = async () => {
  return null;
};

export default function LoginPage() {
  const [userInput, setUserInput] = useState("");
  const [otp, setOtp] = useState("");
  const [isOtpVisible, setIsOtpVisible] = useState(false);
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const source = (location.state as { source?: string })?.source || "";

  const loginMutation = useLogin();
  const verifyLoginMutation = useVerifyLogin();
  const { setAccessToken, initialized, isAuthenticated } = useSession();

  const { data: userResp, isLoading: userLoading } = useUserDetails();
  const userId = userResp?.data?.user?.id as string | undefined;

  const {
    data: paymentMethods,
    isLoading: pmLoading,
    error: pmError,
  } = usePaymentMethods(userId);

  const hasCard = useMemo(() => {
    if (!paymentMethods || !Array.isArray(paymentMethods)) return false;
    return paymentMethods.some((pm) => pm.type === "card" && pm.card);
  }, [paymentMethods]);

  useEffect(() => {
    if (!initialized) return;
    if (isAuthenticated) {
      setIsConnecting(true);
    }
  }, [initialized, isAuthenticated]);

  useEffect(() => {
    if (!isConnecting && !justLoggedIn) return;
    if (!isAuthenticated) {
      setIsConnecting(false);
      setJustLoggedIn(false);
      return;
    }

    if (userLoading) return;
    if (!userId) return;
    if (pmLoading) return;

    if (pmError) {
      navigate("/AddCardRequired", { replace: true, state: { source } });
      setIsConnecting(false);
      setJustLoggedIn(false);
      return;
    }

    if (hasCard) {
      navigate("/UnifiedOptionsPage", { replace: true, state: { source } });
    } else {
      navigate("/AddCardRequired", { replace: true, state: { source } });
    }
    setIsConnecting(false);
    setJustLoggedIn(false);
  }, [
    userId,
    userLoading,
    pmLoading,
    pmError,
    hasCard,
    navigate,
    source,
    isConnecting,
    justLoggedIn,
    isAuthenticated,
  ]);

  const handleFirstContinue = () => {
    setError("");
    if (!userInput) {
      setError("Please enter your email or phone number.");
      return;
    }

    loginMutation.mutate(
      { identifier: userInput },
      {
        onSuccess: (data) => {
          if (data.success) {
            setIsOtpVisible(true);
          } else {
            setError(data.error || "Failed to send OTP. Please try again.");
          }
        },
        onError: (err: any) => {
          setError(err.message || "Failed to send OTP. Please try again.");
        },
      }
    );
  };

  const handleSecondContinue = () => {
    setError("");
    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP.");
      return;
    }

    verifyLoginMutation.mutate(
      { identifier: userInput, otp },
      {
        onSuccess: (data) => {
          if (data.success && data.data?.accessToken) {
            sessionStorage.setItem("accessToken", data.data.accessToken);
            setAccessToken(data.data.accessToken);
            setJustLoggedIn(true);
            setIsConnecting(true);
          } else {
            setError(data.error || "Invalid OTP. Please try again.");
          }
        },
        onError: (err: any) => {
          setError(err.message || "Invalid OTP. Please try again.");
        },
      }
    );
  };

  const handleTryAgain = () => {
    setIsOtpVisible(false);
    setOtp("");
    setError("");
  };

  const isLoading =
    loginMutation.isPending ||
    verifyLoginMutation.isPending ||
    isConnecting ||
    (justLoggedIn && (userLoading || pmLoading));

  return (
    <div className="max-w-md mx-auto px-5 py-10 bg-white font-sans">
      <h1 className="text-4xl font-bold mb-1">Sign in</h1>
      <p className="text-base text-gray-500 mb-5">
        Sign in to your account with your email or mobile number.
      </p>

      <FloatingLabelInput
        label="Email or Phone Number"
        value={userInput}
        onChangeText={setUserInput}
        error={error && !isOtpVisible ? error : ""}
        editable={!isLoading}
      />

      {isOtpVisible && (
        <>
          <p className="text-sm text-gray-500 mb-6">
            We just sent you a temporary login code. Please check your email or
            phone.
            <span
              className="text-blue-500 underline cursor-pointer"
              onClick={handleTryAgain}
            >
              {" "}
              Can't find it? Try again.
            </span>
          </p>
          <FloatingLabelInput
            label="Enter your code"
            value={otp}
            onChangeText={setOtp}
            error={error && isOtpVisible ? error : ""}
            editable={!isLoading}
            type="text"
            maxLength={6}

          />
        </>
      )}

      <button
        onClick={isOtpVisible ? handleSecondContinue : handleFirstContinue}
        disabled={isLoading}
        className={`bg-black rounded-lg py-4 px-5 mb-5 text-white font-bold text-lg w-full border-none cursor-pointer focus:outline-none ${
          isLoading ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        {isLoading
          ? "Loading..."
          : isOtpVisible
          ? "Continue with the code"
          : "Continue"}
      </button>

      <p className="text-xs text-gray-500 text-center w-full">
        By continuing, I agree to Soteria's Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}