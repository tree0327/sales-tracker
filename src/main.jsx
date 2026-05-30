import React from 'react'
import ReactDOM from 'react-dom/client'
import Root from './Root.jsx'
import { ModalProvider } from './context/ModalContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ModalProvider>
      <Root />
    </ModalProvider>
  </React.StrictMode>,
)
