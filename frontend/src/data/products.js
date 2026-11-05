import { productImage } from "../config/images";

const names = ['Ivory Floral Kurti','Rose Gold Silk Saree','Everyday Bloom Dress','Festive Anarkali Set','Soft Cotton Tunic','Printed Chiffon Dupatta','Classic Straight Kurti','Sage Green Co-ord','Midnight Party Dress','Handloom Cotton Saree','Blush Embroidered Top','Everyday Palazzo Set','Maroon Festive Saree','Minimal Linen Shirt','Petal Pink Midi Dress','Indigo Ethnic Set','Champagne Occasion Gown','Floral Summer Kurti'];
const cats = ['Kurtis','Sarees','Dresses','Ethnic Wear','Tops','Dupattas','Kurtis','Ethnic Wear','Dresses','Sarees','Tops','Ethnic Wear','Sarees','Tops','Dresses','Ethnic Wear','Dresses','Kurtis'];
export const initialProducts = names.map((name,i)=>({
 id:`p${i+1}`, name, code:`${['WTK','WSS','WDC','WEA','WTU','WDU'][i%6]}${String(i+1).padStart(3,'0')}`,
 category:cats[i], subcategory:cats[i]==='Sarees'?'Silk Sarees':cats[i]==='Dresses'?'Party Wear':cats[i]==='Kurtis'?'Kurtis':cats[i],
 price: [1499,3299,1899,2799,1199,799,1399,2199,2499,2999,999,1799,3599,1299,1999,2599,3999,1599][i],
 discount:[15,20,10,25,0,15,10,20,30,10,0,15,20,0,15,10,25,10][i],
 stock:[18,8,14,5,22,31,16,9,4,12,20,11,7,25,13,6,3,17][i],
 sizes:['S','M','L','XL'], colors:['Ivory','Rose','Sage'], fabric:i%2?'Silk blend':'Cotton blend',
 isNew:i<6, hotSale:i%3!==1, featured:i<4, status:'Active', image:productImage(i), sold:[42,65,24,39,55,18,30,33,27,61,12,21,48,16,38,29,19,44][i]
}));