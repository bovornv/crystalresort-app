import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import BedDashboard from './components/BedDashboard'

function App() {
  return (
    <Router basename="/bedstatus">
      <Routes>
        <Route path="/" element={<BedDashboard />} />
      </Routes>
    </Router>
  )
}

export default App
