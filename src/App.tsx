import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { AdminRoute, ProtectedRoute } from "./components/ProtectedRoute";
import Catalog from "./pages/Catalog";
import CourseDetail from "./pages/CourseDetail";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Hire from "./pages/Hire";
import Book from "./pages/Book";
import BookingCheckout from "./pages/BookingCheckout";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Checkout from "./pages/Checkout";
import Player from "./pages/Player";
import AdminCourses from "./pages/admin/AdminCourses";
import CourseCreate from "./pages/admin/CourseCreate";
import CourseEditor from "./pages/admin/CourseEditor";
import LessonEditor from "./pages/admin/LessonEditor";
import AdminBookings from "./pages/admin/AdminBookings";
import AdminServices from "./pages/admin/AdminServices";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Catalog />} />
        <Route path="course/:courseId" element={<CourseDetail />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="hire" element={<Hire />} />
        <Route path="book" element={<Book />} />

        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="checkout/:courseId" element={<Checkout />} />
          <Route path="learn/:courseId/:lessonId?" element={<Player />} />
          <Route path="book/:typeId/:slot" element={<BookingCheckout />} />
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="admin" element={<AdminCourses />} />
          <Route path="admin/bookings" element={<AdminBookings />} />
          <Route path="admin/services" element={<AdminServices />} />
          <Route path="admin/courses/new" element={<CourseCreate />} />
          <Route path="admin/courses/:courseId" element={<CourseEditor />} />
          <Route
            path="admin/courses/:courseId/lessons/:lessonId"
            element={<LessonEditor />}
          />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
