import React, { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Developers from "@/pages/Developers";
import PlantDiseasePredictor from "@/pages/PlantDiseasePredictor";
import Dashboard from "@/pages/Dashboard";

// Initialize the Query Client
const queryClient = new QueryClient();

const App: React.FC = () => {
  useEffect(() => {
    // Initialize PWA elements
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }

    // Check if running in Capacitor
    // @ts-ignore
    if (window.Capacitor) {
      console.log('Running in Capacitor');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/predictor" element={<PlantDiseasePredictor />} />
            <Route path="/developers" element={<Developers />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
