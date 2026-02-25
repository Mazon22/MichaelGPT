import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

console.log('✅ JavaScript загружен!')
console.log('✅ React:', React)
console.log('✅ ReactDOM:', ReactDOM)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
