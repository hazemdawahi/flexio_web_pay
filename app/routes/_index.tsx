// src/routes/index.tsx

import React from "react";

const Index: React.FC = () => {
  console.log(navigator.userAgent);
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 font-sans">
      <h1 className="text-3xl font-bold">Welcome to the Remix App!</h1>
      <p className="mt-4 text-lg">Redirecting...</p>
    </div>
  );
};

export default Index;
