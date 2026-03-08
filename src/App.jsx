import { BrowserRouter, Routes, Route } from "react-router-dom";
import Admin from "./Admin";
import Scoreboard from "./Scoreboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Scoreboard />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}