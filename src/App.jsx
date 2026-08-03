

import './App.css'
import Pdtsection from './Components/pdtsection'
import { Routes, Route } from "react-router-dom";


import Accounts from "./Components/accounts";
import Attendance from './Components/Attendance';

function App() {
  
  return (
    <Routes>
            <Route path="/" element={<Pdtsection />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/attendance" element={<Attendance />} />
        </Routes>
  )
}

export default App
