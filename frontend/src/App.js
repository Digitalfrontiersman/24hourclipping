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
import Onboarding from "@/pages/Onboarding";
import ClipperDashboard from "@/pages/clipper/ClipperDashboard";
import JobDetails from "@/pages/clipper/JobDetails";
import ClipperRoom from "@/pages/clipper/ClipperRoom";
import Admin from "@/pages/Admin";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Docs from "@/pages/Docs";
import NotFound from "@/pages/NotFound";
import Privacy from "@/pages/legal/Privacy";
import Cookies from "@/pages/legal/Cookies";
import Terms from "@/pages/legal/Terms";
import ProtectedRoute from "@/components/ProtectedRoute";
import ScrollToTop from "@/components/ScrollToTop";

const Customer = ({ children }) => <ProtectedRoute roles={["customer", "admin"]}>{children}</ProtectedRoute>;
const Clipper = ({ children }) => <ProtectedRoute roles={["clipper", "admin"]}>{children}</ProtectedRoute>;
const AdminOnly = ({ children }) => <ProtectedRoute roles={["admin"]}>{children}</ProtectedRoute>;

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AppProvider>
          <ScrollToTop />
          <Navbar />
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/clippers" element={<Directory />} />
            <Route path="/clippers/:id" element={<ClipperProfile />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/cookies" element={<Cookies />} />
            <Route path="/terms" element={<Terms />} />

            {/* Onboarding (any authed user; runs before dashboards) */}
            <Route path="/onboarding" element={<ProtectedRoute skipOnboarding><Onboarding /></ProtectedRoute>} />

            {/* Customer */}
            <Route path="/customer" element={<Customer><CustomerDashboard /></Customer>} />
            <Route path="/customer/create" element={<Customer><CreateProject /></Customer>} />
            <Route path="/customer/concierge" element={<Customer><Concierge /></Customer>} />
            <Route path="/customer/brand" element={<Customer><BrandProfile /></Customer>} />
            <Route path="/customer/checkout/:projectId" element={<Customer><Checkout /></Customer>} />
            <Route path="/customer/bids/:projectId" element={<Customer><BidRoom /></Customer>} />
            <Route path="/customer/clip-room/:contractId" element={<Customer><ClipRoom /></Customer>} />
            <Route path="/customer/review/:contractId" element={<Customer><DeliveryReview /></Customer>} />

            {/* Clipper */}
            <Route path="/clipper" element={<Clipper><ClipperDashboard /></Clipper>} />
            <Route path="/clipper/job/:projectId" element={<Clipper><JobDetails /></Clipper>} />
            <Route path="/clipper/room/:contractId" element={<Clipper><ClipperRoom /></Clipper>} />

            {/* Admin */}
            <Route path="/admin" element={<AdminOnly><Admin /></AdminOnly>} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster theme="dark" position="top-right" toastOptions={{ style: { background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" } }} />
        </AppProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
