import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import AirconDashboard from './components/AirconDashboard'

function App() {
  return (
    <Router basename="/airconstatus">
      <Routes>
        <Route path="/" element={<AirconDashboard />} />
      </Routes>
    </Router>
  )
}

export default App
