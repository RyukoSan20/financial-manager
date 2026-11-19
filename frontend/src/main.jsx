import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './styles/polish.css'
import './styles/motion.css'
import './styles/insights.css'
import './styles/privacy.css'
import './styles/aurora.css'
import './styles/money.css'
import './styles/split.css'
import './styles/moe.css'
import './styles/merchant.css'
import './styles/login.css'
import './styles/fintech.css'
import './styles/shape.css'
import './styles/mascot-motion.css';
import './styles/cute-editorial.css'
// The campus editorial layer must load AFTER cute-editorial: the ink
// guard and the clipping fixes are deliberate overrides of it.
import './styles/campus-editorial.css'
import './styles/motion-system.css'
// The botanical studio has the last word on colour.
import './styles/botanical.css'
// The real chibi artwork and the physics around it.
import './styles/koban-mascot.css'
import './styles/multi-theme.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
