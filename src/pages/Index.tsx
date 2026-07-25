import { useState } from "react";
import { Layout } from "@/components/Layout";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Triage from "./Triage";
import Education from "./Education";
import Settings from "./Settings";

export default function Index() {
  const [activeTab, setActiveTab] = useState("triage");

  const renderContent = () => {
    switch (activeTab) {
      case "triage":
        return <Triage />;
      case "education":
        return <Education />;
      case "settings":
        return <Settings />;
      default:
        return <Triage />;
    }
  };

  return (
    <LanguageProvider>
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        {renderContent()}
      </Layout>
    </LanguageProvider>
  );
}
