import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { defaultLanguage, normalizeLanguage, type Language } from '../../common/translation/language'

export interface StorageState {
  lang: Language
}

const initialState: StorageState = { lang: defaultLanguage }

export const storageSlice = createSlice({
  name: 'storage',
  initialState,
  reducers: {
    changeLanguage(state, action: PayloadAction<string>) {
      state.lang = normalizeLanguage(action.payload)
    },
    languageReceived(state, action: PayloadAction<string>) {
      state.lang = normalizeLanguage(action.payload)
    },
    storageSync(state, action: PayloadAction<{ lang?: string }>) {
      if (action.payload.lang !== undefined) state.lang = normalizeLanguage(action.payload.lang)
    },
  },
})

export const { changeLanguage, languageReceived, storageSync } = storageSlice.actions
export default storageSlice.reducer
