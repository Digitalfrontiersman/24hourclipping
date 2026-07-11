import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AppProvider } from "@/context/AppContext";
import Navbar from "@/components/Navbar";
import Landing from "@/pages/Landing";
import Marketplace from "@/pages/Marketplace";
import Directory from "@/pages/Directory";
import ClipperProfile from "@/pages/ClipperProfile";
import CustomerDashboard from "@/pages/customer/CustomerDashboard";
import CreateProject from "@/pages/customer/CreateProject";
import Concierge from "@/pages/customer/Concierge";
import BrandProfile from "@/pages/customer/BrandProfile";
import Checkout from "@/pages/customer/Checkout";
import BidRoom from "@/pages/customer/BidRoom";
import ClipRoom from "@/pages/customer/ClipRoom";
import DeliveryReview from "@/pages/customer/DeliveryReview";
import ClipperOnboarding from "@/pages/clipper/ClipperOnboarding";
import ClipperDashboard from "@/pages/clipper/ClipperDashboard";
import JobDetails from "@/pages/clipper/JobDetails";
import ClipperRoom from "@/pages/clipper/ClipperRoom";
import Admin from "@/pages/Admin";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AppProvider>
          <Navbar />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/clippers" element={<Directory />} />
            <Route path="/clippers/:id" element={<ClipperProfile />} />
            <Route path="/customer" element={<CustomerDashboard />} />
            <Route path="/customer/create" element={<CreateProject />} />
            <Route path="/customer/concierge" element={<Concierge />} />
            <Route path="/customer/brand" element={<BrandProfile />} />
            <Route path="/customer/checkout/:projectId" element={<Checkout />} />
            <Route path="/customer/bids/:projectId" element={<BidRoom />} />
            <Route path="/customer/clip-room/:contractId" element={<ClipRoom />} />
            <Route path="/customer/review/:contractId" element={<DeliveryReview />} />
            <Route path="/clipper/onboarding" element={<ClipperOnboarding />} />
            <Route path="/clipper" element={<ClipperDashboard />} />
            <Route path="/clipper/job/:projectId" element={<JobDetails />} />
            <Route path="/clipper/room/:contractId" element={<ClipperRoom />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
          <Toaster theme="dark" position="top-right" toastOptions={{ style: { background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" } }} />
        </AppProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
