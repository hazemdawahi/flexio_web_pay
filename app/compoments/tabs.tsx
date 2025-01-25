// src/components/Tabs.tsx
import React, { ReactNode } from "react";

interface Tab {
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultIndex?: number;
}

const Tabs: React.FC<TabsProps> = ({ tabs, defaultIndex = 0 }) => {
  const [activeIndex, setActiveIndex] = React.useState(defaultIndex);

  return (
    <div className="w-full">
      {/* Tab Headers */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab, index) => (
          <button
            key={index}
            className={`flex-1 py-2 text-center 
              ${
                activeIndex === index
                  ? "border-b-2 border-black text-black font-bold"
                  : "text-gray-500 hover:text-black"
              }`}
            onClick={() => setActiveIndex(index)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-4">{tabs[activeIndex].content}</div>
    </div>
  );
};

export default Tabs;
