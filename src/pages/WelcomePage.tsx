import { useNavigate } from 'react-router-dom'
import './WelcomePage.scss'

function WelcomePage() {
  const navigate = useNavigate()

  return (
    <div className="welcome-page">
      <img src="./welcome.png" alt="欢迎" className="welcome-image" />
      <h1 className="welcome-title">Welcome to CipherTalk</h1>
    </div>
  )
}

export default WelcomePage
