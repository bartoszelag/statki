import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Lobby from './pages/Lobby'
import Game from './pages/Game'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/game/:id" element={<Game />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
