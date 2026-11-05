const productPhotos = [
  "35504999",
  "35108814",
  "11974169",
  "34673508",
  "31879669",
  "13860638",
  "28512776",
  "13709861",
  "13330466",
  "7920188",
      "31879669",
,
  "18665105",
  "32683757",
  "37166936",
  "18655105",
  "15613165",
  "37457419",
  "30809730",
];

const categoryPhotos = {
  kurtis: "35504999",
  sarees: "35108814",
  dresses: "34673508",
  "ethnic wear": "34673508",
  tops: "31879669",
  dupattas: "13860638",
};

function imageUrl(photo, width, height) {
  return `https://images.pexels.com/photos/${photo}/pexels-photo-${photo}.jpeg?auto=compress&cs=tinysrgb&w=${width}&h=${height}`;
}

export function productImage(index, width = 900, height = 1200) {
  return imageUrl(productPhotos[index] ?? productPhotos[0], width, height);
}

export function categoryImage(category, width = 800, height = 1000) {
  const photo = categoryPhotos[category.toLowerCase()] ?? categoryPhotos.kurtis;
  return imageUrl(photo, width, height);
}

export const fashionImages = {
  hero: imageUrl("28512787", 1200, 1500),
  collection: imageUrl(categoryPhotos["ethnic wear"], 1400, 900),
  community: imageUrl("7920188", 1000, 1200),
  login: imageUrl("28512787", 1000, 1400),
  about: imageUrl("15613165", 1000, 1400),
};