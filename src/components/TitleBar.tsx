import './TitleBar.scss'

function TitleBar() {
  return (
    <div className="title-bar">
      <img src="./logo.png" alt="密语" className="title-logo" />
      <span className="titles">CipherTalk</span>
    </div>
  )
}

export default TitleBar
