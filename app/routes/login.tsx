import React, { useState } from 'react';
import FloatingLabelInput from '~/compoments/Floatinglabelinpunt';

export default function LoginPage() {
  const [userInput, setUserInput] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpVisible, setIsOtpVisible] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFirstContinue = () => {
    setError('');
    if (!userInput) {
      setError('Please enter your email or phone number.');
      return;
    }
    // Simulate sending OTP
    setIsOtpVisible(true);
  };

  const handleSecondContinue = () => {
    setError('');
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP.');
      return;
    }
    // Simulate OTP verification success
    alert('OTP Verified. Logged in!');
  };

  const handleTryAgain = () => {
    setIsOtpVisible(false);
    setOtp('');
    setError('');
  };

  return (
    <div className="mx-auto px-5 py-10 bg-white font-sans">
      <h1 className="text-4xl  font-bold mb-1">Sign in</h1>
      <p className="text-base text-gray-500 mb-5">
        Sign in to your account with your email or mobile number.
      </p>

      {/* Email/Phone Input */}
      <FloatingLabelInput
        label="Email or Phone Number"
        value={userInput}
        onChangeText={setUserInput}
        error={error && !isOtpVisible ? error : ''}
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
              {' '}Can't find it? Try again.
            </span>
          </p>
          <FloatingLabelInput
            label="Enter your code"
            value={otp}
            onChangeText={setOtp}
            error={error && isOtpVisible ? error : ''}
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
          isLoading ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        {isLoading ? 'Loading...' : (isOtpVisible ? 'Continue with the code' : 'Continue')}
      </button>

      <p className="text-xs text-gray-500 text-center w-full">
        By continuing, I agree to Soteria's Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}
