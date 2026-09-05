import { StrictMode } from 'react'
import { Provider } from 'react-redux'
import './index.scss'
import App from './App'
import store from './store'
import LocaleProvider from './LocaleProvider'

export default function SettingEntry() {
  return (
    <StrictMode>
      <Provider store={store}>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </Provider>
    </StrictMode>
  )
}
