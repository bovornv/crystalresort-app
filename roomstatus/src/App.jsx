import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import MaintenanceHistoryPage from './components/MaintenanceHistoryPage'

function App() {
  return (
    <Router basename="/roomstatus">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/maintenance-history" element={<MaintenanceHistoryPage />} />
      </Routes>
    </Router>
  )
}

export default App

