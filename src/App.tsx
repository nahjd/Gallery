import { BrowserRouter, Routes, Route } from "react-router-dom"
import Gallery from "./pages/Gallery"
import Admin from "./pages/Admin"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Gallery />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
