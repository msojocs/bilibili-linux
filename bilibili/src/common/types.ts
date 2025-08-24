export const Page = {
    Login: 'login',
    Home: 'home',
    Unknown: 'Unknown'
} as const
export type PageType = typeof Page[keyof typeof Page]
export interface Bvid2DynamicIdType {
    bvid: string
    dynamic_id: string
}