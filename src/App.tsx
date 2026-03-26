import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import SkillGraphPage from './pages/SkillGraphPage'
import LearnMode from './pages/LearnMode'
import DrillMode from './pages/DrillMode'
import AdvanceMode from './pages/AdvanceMode'
import ForceHanonMode from './pages/ForceHanonMode'
import ProgressPage from './pages/ProgressPage'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/graph" element={<SkillGraphPage />} />
          <Route path="/session/learn" element={<LearnMode />} />
          <Route path="/session/drill" element={<DrillMode />} />
          <Route path="/session/advance" element={<AdvanceMode />} />
          <Route path="/session/force-hanon" element={<ForceHanonMode />} />
          <Route path="/progress" element={<ProgressPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
