export interface TrelloLabel {
  id: string
  name: string
  color: string
}

export interface TrelloMember {
  id: string
  fullName: string
  username: string
  avatarUrl?: string | null
}

export interface TrelloCheckItem {
  id: string
  name: string
  state: string
}

export interface TrelloChecklist {
  id: string
  name: string
  checkItems: TrelloCheckItem[]
}

export interface TrelloCustomField {
  id: string
  fieldName: string
  fieldType: string
  value: string | null
}

export interface TrelloAttachment {
  id: string
  name: string
  url: string
  date: string
}

export interface ParsedTrelloCard {
  id: string
  name: string
  desc: string
  due: string | null
  dueComplete: boolean
  dateLastActivity: string | null
  closed: boolean
  url: string
  shortUrl: string
  labels: TrelloLabel[]
  boardName: string | null
  listName: string | null
  members: TrelloMember[]
  checklists: TrelloChecklist[]
  customFields: TrelloCustomField[]
  attachments: TrelloAttachment[]
}
