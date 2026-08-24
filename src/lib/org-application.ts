export type OrgType = "school" | "cram_school" | "company" | "club" | "other";

export const ORG_TYPES: Array<{ value: OrgType; label: string; hint: string }> = [
  { value: "school", label: "学校", hint: "小・中・高・高専・大学・専門学校など" },
  { value: "cram_school", label: "学習塾", hint: "塾・予備校・個別指導・家庭教師センター" },
  { value: "company", label: "企業・法人", hint: "社内研修・資格取得支援など" },
  { value: "club", label: "サークル・団体", hint: "部活動・学習コミュニティ・NPO" },
  { value: "other", label: "その他", hint: "上記に当てはまらない場合は内容をご記入ください" },
];

export const ORG_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  ORG_TYPES.map((t) => [t.value, t.label]),
);

export const COUNTRIES = [
  "日本",
  "アメリカ合衆国",
  "カナダ",
  "イギリス",
  "オーストラリア",
  "中国",
  "韓国",
  "台湾",
  "シンガポール",
  "タイ",
  "ベトナム",
  "インドネシア",
  "フィリピン",
  "マレーシア",
  "インド",
  "ドイツ",
  "フランス",
  "ブラジル",
  "その他",
];

export const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県",
  "滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

/** 種別ごとに「組織名」欄の見せ方を変える。 */
export function orgNameLabel(type: OrgType | null): string {
  switch (type) {
    case "school":
      return "学校名";
    case "cram_school":
      return "塾・予備校名";
    case "company":
      return "会社・法人名";
    case "club":
      return "団体・サークル名";
    default:
      return "組織名";
  }
}

export function departmentLabel(type: OrgType | null): string {
  switch (type) {
    case "school":
      return "担当部署名（例: 教務部）";
    case "cram_school":
      return "校舎・部署名（例: 本校 教室運営）";
    case "company":
      return "部署名（例: 人事部）";
    case "club":
      return "担当（例: 代表・顧問）";
    default:
      return "担当部署名";
  }
}

export const APP_STATUS_LABEL: Record<string, string> = {
  pending: "審査中",
  approved: "承認済み",
  rejected: "却下",
  suspended: "停止中",
};

export interface OrgApplicationDraft {
  org_type: OrgType | null;
  org_type_other: string;
  org_name: string;
  rep_last_name: string;
  rep_first_name: string;
  rep_last_kana: string;
  rep_first_kana: string;
  department: string;
  contact_email: string;
  contact_phone: string;
  country: string;
  prefecture: string;
  address: string;
  website: string;
  expected_users: string;
  note: string;
}

export const EMPTY_DRAFT: OrgApplicationDraft = {
  org_type: null,
  org_type_other: "",
  org_name: "",
  rep_last_name: "",
  rep_first_name: "",
  rep_last_kana: "",
  rep_first_kana: "",
  department: "",
  contact_email: "",
  contact_phone: "",
  country: "日本",
  prefecture: "",
  address: "",
  website: "",
  expected_users: "",
  note: "",
};
