// 브라우저 언어 감지
// export const formatEventDate = (dateString: string) => {
//   const userLocale = navigator.language || "ko-KR";
//   const date = new Date(dateString + "T00:00:00.000Z");

//   return date.toLocaleDateString(userLocale, {
//     year: "numeric",
//     month: "long",
//     day: "numeric",
//     timeZone: "UTC",
//   });
// };

export const formatEventDate = (dateString: string) => {
  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) {
    return "";
  }

  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
};
