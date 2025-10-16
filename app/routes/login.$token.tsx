import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { useLogin, LoginRequest } from "~/hooks/useLogin";
import { useVerifyLogin, VerifyLoginRequest } from "~/hooks/useVerifyLogin";
import { useSession } from "~/context/SessionContext";
import FloatingLabelInput from "~/compoments/Floatinglabelinpunt";

// ✅ Payment methods + user details
import { usePaymentMethods } from "~/hooks/usePaymentMethods";
import { useUserDetails } from "~/hooks/useUserDetails";

const LoginPage: React.FC = () => {
  const [userInput, setUserInput] = useState("");
  const [otp, setOtp] = useState("");
  const [isOtpVisible, setIsOtpVisible] = useState(false);
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const source = (location.state as { source?: string })?.source || "";

  const loginMutation = useLogin();
  const verifyLoginMutation = useVerifyLogin();
  const { setAccessToken } = useSession();

  // Pull user details envelope (UserDetailsResponse)
  const { data: userResp } = useUserDetails();

  // ✅ FIX: derive userId from the envelope (data?.user?.id), not directly from response
  const userId = userResp?.data?.user?.id as string | undefined;

  // Enable payment methods fetch only when we actually have a userId
  const {
    data: paymentMethods,
    isLoading: pmLoading,
    error: pmError,
  } = usePaymentMethods(userId);

  // Derived: do we have at least one card?
  const hasCard = useMemo(() => {
    if (!paymentMethods || !Array.isArray(paymentMethods)) return false;
    return paymentMethods.some((pm) => pm.type === "card" && pm.card);
  }, [paymentMethods]);

  // If an access token already exists, show connecting state while we decide where to go
  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return; // user not logged yet; continue normal flow
    setIsConnecting(true);
  }, []);

  // Once logged in (existing token OR just verified), route based on payment methods
  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;            // not authenticated yet
    if (!userId) return;           // user details not ready yet
    if (pmLoading) return;         // still checking PMs

    // If fetching PMs failed, route to AddCardRequired (strict requirement)
    if (pmError) {
      navigate(`/AddCardRequired`, { replace: true, state: { source } });
      setIsConnecting(false);
      return;
    }

    // Route based on card presence
    if (hasCard) {
      navigate(`/UnifiedOptionsPage`, { replace: true, state: { source } });
    } else {
      navigate(`/AddCardRequired`, { replace: true, state: { source } });
    }
    setIsConnecting(false);
  }, [userId, pmLoading, pmError, hasCard, navigate, source]);

  const handleFirstContinue = () => {
    setError("");
    if (!userInput) {
      setError("Please enter your email or phone number.");
      return;
    }

    const loginRequest: LoginRequest = {
      identifier: userInput,
    };

    loginMutation.mutate(loginRequest, {
      onSuccess: (data) => {
        if (data.success) {
          setIsOtpVisible(true);
        } else {
          setError(data.error || "Failed to send OTP. Please try again.");
        }
      },
      onError: (error: any) => {
        setError(error.message || "Failed to send OTP. Please try again.");
      },
    });
  };

  const handleSecondContinue = () => {
    setError("");
    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP.");
      return;
    }

    const verifyRequest: VerifyLoginRequest = {
      identifier: userInput,
      otp,
    };

    verifyLoginMutation.mutate(verifyRequest, {
      onSuccess: (data) => {
        if (data.success && data.data?.accessToken) {
          // Save the access token in sessionStorage and context
          sessionStorage.setItem("accessToken", data.data.accessToken);
          setAccessToken(data.data.accessToken);

          // Let the post-auth effect above check payment methods and route
          setIsConnecting(true);
        } else {
          setError(data.error || "Invalid OTP. Please try again.");
        }
      },
      onError: (error: any) => {
        setError(error.message || "Invalid OTP. Please try again.");
      },
    });
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
    pmLoading;

  return (
    <div className="max-w-md mx-auto px-5 py-10 bg-white font-sans">
      <h1 className="text-4xl font-bold mb-1">Sign in</h1>
      <p className="text-base text-gray-500 mb-5">
        Sign in to your account with your email or mobile number.
      </p>

      {/* Email/Phone Input */}
      <FloatingLabelInput
        label="Email or Phone Number"
        value={userInput}
        onChangeText={setUserInput}
        error={error && !isOtpVisible ? error : ""}
        editable={!isLoading}
      />

      {/* OTP Input */}
      {isOtpVisible && (
        <>
          <p className="text-sm text-gray-500 mb-6">
            We just sent you a temporary login code. Please check your email or phone.
            <span
              className="text-blue-500 underline cursor-pointer"
              onClick={handleTryAgain}
            >
              {" "}Can't find it? Try again.
            </span>
          </p>
          <FloatingLabelInput
            label="Enter your code"
            value={otp}
            onChangeText={setOtp}
            error={error && isOtpVisible ? error : ""}
            editable={!isLoading}
            type="text"
          />
        </>
      )}

      {/* Continue Button */}
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
};

export default LoginPage;
