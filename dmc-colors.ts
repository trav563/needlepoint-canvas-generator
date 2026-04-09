// DMC Embroidery Floss Color Database with CIE Lab matching
// ~489 standard DMC thread colors

export interface DmcColor {
  dmc: string;
  name: string;
  hex: string;
  r: number;
  g: number;
  b: number;
  lab?: [number, number, number];
}

// sRGB -> linear RGB
function linearize(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

// RGB -> CIE Lab (D65 illuminant)
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lr = linearize(r);
  const lg = linearize(g);
  const lb = linearize(b);

  // sRGB to XYZ (D65)
  let x = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb;
  let y = 0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb;
  let z = 0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb;

  // Normalize to D65 white point
  x /= 0.95047;
  y /= 1.0;
  z /= 1.08883;

  const epsilon = 0.008856;
  const kappa = 903.3;

  const fx = x > epsilon ? Math.cbrt(x) : (kappa * x + 16) / 116;
  const fy = y > epsilon ? Math.cbrt(y) : (kappa * y + 16) / 116;
  const fz = z > epsilon ? Math.cbrt(z) : (kappa * z + 16) / 116;

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bVal = 200 * (fy - fz);

  return [L, a, bVal];
}

// CIE76 distance in Lab space
export function labDistance(lab1: [number, number, number], lab2: [number, number, number]): number {
  const dL = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

// Raw DMC color data: [dmcNumber, name, r, g, b]
const DMC_RAW: [string, string, number, number, number][] = [
  ["BLANC", "White", 252, 251, 248],
  ["ECRU", "Ecru", 240, 234, 218],
  ["B5200", "Snow White", 255, 255, 255],
  ["150", "Ultra Very Dark Dusty Rose", 171, 2, 73],
  ["151", "Very Light Dusty Rose", 240, 206, 212],
  ["152", "Medium Light Shell Pink", 226, 160, 153],
  ["153", "Very Light Violet", 230, 204, 217],
  ["154", "Very Dark Grape", 87, 36, 51],
  ["155", "Medium Dark Blue Violet", 152, 145, 182],
  ["156", "Medium Light Blue Violet", 163, 174, 209],
  ["157", "Very Light Cornflower Blue", 187, 195, 217],
  ["158", "Medium Very Dark Cornflower Blue", 76, 82, 110],
  ["159", "Light Gray Blue", 199, 202, 215],
  ["160", "Medium Gray Blue", 153, 159, 183],
  ["161", "Gray Blue", 120, 128, 164],
  ["162", "Ultra Very Light Blue", 219, 236, 245],
  ["163", "Medium Celadon Green", 77, 131, 97],
  ["164", "Light Forest Green", 200, 216, 184],
  ["165", "Very Light Moss Green", 239, 244, 164],
  ["166", "Medium Light Moss Green", 192, 200, 64],
  ["167", "Very Dark Yellow Beige", 167, 124, 73],
  ["168", "Very Light Pewter", 209, 209, 209],
  ["169", "Light Pewter", 132, 132, 132],
  ["208", "Very Dark Lavender", 131, 91, 139],
  ["209", "Dark Lavender", 163, 123, 167],
  ["210", "Medium Lavender", 195, 159, 195],
  ["211", "Light Lavender", 227, 203, 227],
  ["221", "Very Dark Shell Pink", 136, 62, 67],
  ["223", "Light Shell Pink", 204, 132, 124],
  ["224", "Very Light Shell Pink", 235, 183, 176],
  ["225", "Ultra Very Light Shell Pink", 255, 223, 213],
  ["300", "Very Dark Mahogany", 111, 47, 0],
  ["301", "Medium Mahogany", 179, 95, 43],
  ["304", "Medium Red", 183, 31, 51],
  ["307", "Lemon", 253, 237, 84],
  ["309", "Dark Rose", 186, 74, 74],
  ["310", "Black", 0, 0, 0],
  ["311", "Medium Navy Blue", 28, 80, 102],
  ["312", "Very Dark Baby Blue", 53, 102, 139],
  ["315", "Medium Dark Antique Mauve", 129, 73, 82],
  ["316", "Medium Antique Mauve", 183, 115, 127],
  ["317", "Pewter Gray", 108, 108, 108],
  ["318", "Light Steel Gray", 171, 171, 171],
  ["319", "Very Dark Pistachio Green", 32, 95, 46],
  ["320", "Medium Pistachio Green", 105, 136, 90],
  ["321", "Red", 199, 43, 59],
  ["322", "Dark Baby Blue", 90, 143, 184],
  ["326", "Very Dark Rose", 179, 59, 75],
  ["327", "Dark Violet", 99, 54, 102],
  ["333", "Very Dark Blue Violet", 92, 84, 120],
  ["334", "Medium Baby Blue", 115, 159, 193],
  ["335", "Rose", 238, 84, 110],
  ["336", "Navy Blue", 37, 59, 115],
  ["340", "Medium Blue Violet", 173, 167, 199],
  ["341", "Light Blue Violet", 183, 191, 221],
  ["347", "Very Dark Salmon", 191, 45, 45],
  ["349", "Dark Coral", 210, 16, 53],
  ["350", "Medium Coral", 224, 72, 72],
  ["351", "Coral", 233, 106, 103],
  ["352", "Light Coral", 253, 156, 151],
  ["353", "Peach", 254, 215, 204],
  ["355", "Dark Terra Cotta", 152, 68, 54],
  ["356", "Medium Terra Cotta", 197, 106, 91],
  ["367", "Dark Pistachio Green", 97, 122, 82],
  ["368", "Light Pistachio Green", 166, 194, 152],
  ["369", "Very Light Pistachio Green", 215, 237, 204],
  ["370", "Medium Mustard", 184, 157, 100],
  ["371", "Mustard", 191, 166, 113],
  ["372", "Light Mustard", 204, 183, 132],
  ["400", "Dark Mahogany", 143, 67, 15],
  ["402", "Very Light Mahogany", 247, 167, 119],
  ["407", "Dark Desert Sand", 187, 129, 97],
  ["413", "Dark Pewter Gray", 86, 86, 86],
  ["414", "Dark Steel Gray", 140, 140, 140],
  ["415", "Pearl Gray", 211, 211, 214],
  ["420", "Dark Hazelnut Brown", 160, 112, 66],
  ["422", "Light Hazelnut Brown", 198, 159, 123],
  ["433", "Medium Brown", 122, 69, 31],
  ["434", "Light Brown", 152, 94, 51],
  ["435", "Very Light Brown", 184, 119, 72],
  ["436", "Tan", 203, 144, 81],
  ["437", "Light Tan", 228, 187, 142],
  ["444", "Dark Lemon", 255, 214, 0],
  ["445", "Light Lemon", 255, 251, 139],
  ["451", "Dark Shell Gray", 145, 123, 115],
  ["452", "Medium Shell Gray", 192, 179, 174],
  ["453", "Light Shell Gray", 215, 206, 203],
  ["469", "Avocado Green", 114, 132, 60],
  ["470", "Light Avocado Green", 148, 171, 79],
  ["471", "Very Light Avocado Green", 174, 191, 121],
  ["472", "Ultra Light Avocado Green", 216, 228, 152],
  ["498", "Dark Red", 167, 19, 43],
  ["500", "Very Dark Blue Green", 4, 77, 51],
  ["501", "Dark Blue Green", 57, 111, 82],
  ["502", "Blue Green", 91, 144, 113],
  ["503", "Medium Blue Green", 123, 172, 148],
  ["504", "Very Light Blue Green", 196, 222, 204],
  ["505", "Jade Green", 51, 131, 98],
  ["517", "Dark Wedgwood", 59, 118, 143],
  ["518", "Light Wedgwood", 79, 147, 167],
  ["519", "Sky Blue", 126, 177, 200],
  ["520", "Dark Fern Green", 102, 109, 79],
  ["522", "Fern Green", 150, 158, 126],
  ["523", "Light Fern Green", 171, 177, 151],
  ["524", "Very Light Fern Green", 196, 205, 172],
  ["535", "Very Light Ash Gray", 99, 100, 88],
  ["543", "Ultra Very Light Beige Brown", 242, 227, 206],
  ["550", "Very Dark Violet", 92, 24, 78],
  ["552", "Medium Violet", 128, 58, 107],
  ["553", "Violet", 163, 99, 139],
  ["554", "Light Violet", 219, 179, 203],
  ["561", "Very Dark Jade", 44, 106, 69],
  ["562", "Medium Jade", 83, 151, 106],
  ["563", "Light Jade", 143, 192, 152],
  ["564", "Very Light Jade", 167, 205, 175],
  ["580", "Dark Moss Green", 136, 141, 51],
  ["581", "Moss Green", 167, 174, 56],
  ["597", "Turquoise", 91, 163, 179],
  ["598", "Light Turquoise", 144, 195, 204],
  ["600", "Very Dark Cranberry", 205, 47, 99],
  ["601", "Dark Cranberry", 209, 40, 106],
  ["602", "Medium Cranberry", 226, 72, 116],
  ["603", "Cranberry", 255, 115, 140],
  ["604", "Light Cranberry", 255, 176, 190],
  ["605", "Very Light Cranberry", 255, 192, 205],
  ["606", "Bright Orange Red", 250, 50, 3],
  ["608", "Bright Orange", 253, 93, 53],
  ["610", "Dark Drab Brown", 121, 96, 71],
  ["611", "Drab Brown", 150, 118, 86],
  ["612", "Light Drab Brown", 188, 154, 120],
  ["613", "Very Light Drab Brown", 220, 196, 170],
  ["632", "Ultra Very Dark Desert Sand", 135, 85, 57],
  ["640", "Very Dark Beige Gray", 133, 123, 108],
  ["642", "Dark Beige Gray", 164, 152, 120],
  ["644", "Medium Beige Gray", 221, 216, 203],
  ["645", "Very Dark Beaver Gray", 110, 101, 92],
  ["646", "Dark Beaver Gray", 135, 125, 115],
  ["647", "Medium Beaver Gray", 176, 166, 156],
  ["648", "Light Beaver Gray", 188, 180, 172],
  ["666", "Bright Red", 227, 29, 66],
  ["676", "Light Old Gold", 229, 206, 151],
  ["677", "Very Light Old Gold", 245, 236, 203],
  ["680", "Dark Old Gold", 188, 141, 14],
  ["699", "Christmas Green", 5, 101, 23],
  ["700", "Bright Christmas Green", 7, 115, 27],
  ["701", "Light Christmas Green", 63, 143, 41],
  ["702", "Kelly Green", 71, 167, 47],
  ["703", "Chartreuse", 123, 181, 71],
  ["704", "Bright Chartreuse", 158, 207, 52],
  ["712", "Cream", 255, 251, 239],
  ["718", "Plum", 156, 36, 98],
  ["720", "Dark Orange Spice", 229, 92, 31],
  ["721", "Medium Orange Spice", 242, 120, 66],
  ["722", "Light Orange Spice", 247, 151, 111],
  ["725", "Medium Light Topaz", 255, 200, 64],
  ["726", "Light Topaz", 253, 215, 85],
  ["727", "Very Light Topaz", 255, 241, 175],
  ["728", "Topaz", 228, 180, 104],
  ["729", "Medium Old Gold", 208, 165, 62],
  ["730", "Very Dark Olive Green", 130, 123, 48],
  ["731", "Dark Olive Green", 147, 139, 55],
  ["732", "Olive Green", 148, 140, 54],
  ["733", "Medium Olive Green", 188, 179, 76],
  ["734", "Light Olive Green", 199, 192, 119],
  ["738", "Very Light Tan", 236, 204, 158],
  ["739", "Ultra Very Light Tan", 248, 228, 200],
  ["740", "Tangerine", 255, 131, 19],
  ["741", "Medium Tangerine", 255, 163, 43],
  ["742", "Light Tangerine", 255, 183, 85],
  ["743", "Medium Yellow", 254, 211, 118],
  ["744", "Pale Yellow", 255, 231, 147],
  ["745", "Light Pale Yellow", 255, 233, 173],
  ["746", "Off White", 252, 252, 238],
  ["747", "Very Light Sky Blue", 229, 252, 253],
  ["754", "Light Peach", 247, 203, 191],
  ["758", "Very Light Terra Cotta", 238, 170, 155],
  ["760", "Salmon", 245, 173, 173],
  ["761", "Light Salmon", 255, 201, 201],
  ["762", "Very Light Pearl Gray", 236, 236, 236],
  ["772", "Very Light Yellow Green", 228, 236, 212],
  ["775", "Very Light Baby Blue", 217, 235, 241],
  ["776", "Medium Pink", 252, 176, 185],
  ["778", "Very Light Antique Mauve", 223, 179, 187],
  ["780", "Ultra Very Dark Topaz", 148, 99, 26],
  ["781", "Very Dark Topaz", 162, 109, 32],
  ["782", "Dark Topaz", 174, 119, 32],
  ["783", "Medium Topaz", 206, 145, 36],
  ["791", "Very Dark Cornflower Blue", 70, 69, 99],
  ["792", "Dark Cornflower Blue", 85, 91, 123],
  ["793", "Medium Cornflower Blue", 112, 125, 162],
  ["794", "Light Cornflower Blue", 143, 156, 193],
  ["796", "Dark Royal Blue", 17, 65, 109],
  ["797", "Royal Blue", 19, 71, 125],
  ["798", "Dark Delft Blue", 70, 106, 142],
  ["799", "Medium Delft Blue", 116, 142, 182],
  ["800", "Pale Delft Blue", 192, 204, 222],
  ["801", "Dark Coffee Brown", 101, 57, 25],
  ["803", "Ultra Very Dark Baby Blue", 44, 89, 124],
  ["806", "Dark Peacock Blue", 61, 149, 165],
  ["807", "Peacock Blue", 100, 171, 186],
  ["809", "Delft Blue", 148, 168, 198],
  ["813", "Light Blue", 161, 194, 215],
  ["814", "Dark Garnet", 123, 0, 27],
  ["815", "Medium Garnet", 135, 7, 31],
  ["816", "Garnet", 151, 11, 35],
  ["817", "Very Dark Coral Red", 187, 5, 31],
  ["818", "Baby Pink", 255, 223, 217],
  ["819", "Light Baby Pink", 255, 238, 235],
  ["820", "Very Dark Royal Blue", 14, 54, 92],
  ["822", "Light Beige Gray", 231, 226, 211],
  ["823", "Dark Navy Blue", 33, 48, 99],
  ["824", "Very Dark Blue", 57, 105, 135],
  ["825", "Dark Blue", 71, 129, 165],
  ["826", "Medium Blue", 107, 158, 191],
  ["827", "Very Light Blue", 189, 221, 237],
  ["828", "Ultra Very Light Blue", 197, 232, 237],
  ["829", "Very Dark Golden Olive", 126, 107, 66],
  ["830", "Dark Golden Olive", 141, 120, 73],
  ["831", "Medium Golden Olive", 170, 143, 86],
  ["832", "Golden Olive", 189, 155, 81],
  ["833", "Light Golden Olive", 200, 171, 108],
  ["834", "Very Light Golden Olive", 219, 190, 127],
  ["838", "Very Dark Beige Brown", 89, 73, 55],
  ["839", "Dark Beige Brown", 103, 85, 65],
  ["840", "Medium Beige Brown", 154, 124, 92],
  ["841", "Light Beige Brown", 182, 155, 126],
  ["842", "Very Light Beige Brown", 209, 186, 161],
  ["844", "Ultra Dark Beaver Gray", 72, 72, 72],
  ["868", "Very Dark Hazelnut Brown", 153, 92, 48],
  ["869", "Very Dark Hazelnut Brown", 131, 94, 57],
  ["890", "Ultra Dark Pistachio Green", 23, 73, 35],
  ["891", "Dark Carnation", 255, 87, 115],
  ["892", "Medium Carnation", 255, 121, 140],
  ["893", "Light Carnation", 252, 144, 162],
  ["894", "Very Light Carnation", 255, 178, 187],
  ["895", "Very Dark Hunter Green", 27, 83, 0],
  ["898", "Very Dark Coffee Brown", 73, 42, 19],
  ["899", "Medium Rose", 242, 118, 136],
  ["900", "Dark Burnt Orange", 209, 88, 7],
  ["902", "Very Dark Garnet", 130, 38, 55],
  ["904", "Very Dark Parrot Green", 85, 120, 34],
  ["905", "Dark Parrot Green", 98, 138, 40],
  ["906", "Medium Parrot Green", 127, 179, 53],
  ["907", "Light Parrot Green", 199, 230, 102],
  ["909", "Very Dark Emerald Green", 21, 111, 73],
  ["910", "Dark Emerald Green", 24, 126, 86],
  ["911", "Medium Emerald Green", 24, 144, 101],
  ["912", "Light Emerald Green", 27, 157, 107],
  ["913", "Medium Nile Green", 109, 171, 119],
  ["915", "Dark Plum", 130, 0, 67],
  ["917", "Medium Plum", 155, 19, 89],
  ["918", "Dark Red Copper", 130, 52, 10],
  ["919", "Red Copper", 166, 69, 16],
  ["920", "Medium Copper", 172, 84, 20],
  ["921", "Copper", 198, 98, 24],
  ["922", "Light Copper", 226, 115, 35],
  ["924", "Very Dark Gray Green", 86, 106, 106],
  ["926", "Medium Gray Green", 152, 174, 174],
  ["927", "Light Gray Green", 189, 203, 203],
  ["928", "Very Light Gray Green", 221, 227, 227],
  ["930", "Dark Antique Blue", 69, 92, 113],
  ["931", "Medium Antique Blue", 106, 133, 158],
  ["932", "Light Antique Blue", 162, 181, 198],
  ["934", "Black Avocado Green", 49, 57, 25],
  ["935", "Dark Avocado Green", 66, 77, 33],
  ["936", "Very Dark Avocado Green", 76, 88, 38],
  ["937", "Medium Avocado Green", 98, 113, 51],
  ["938", "Ultra Dark Coffee Brown", 54, 31, 14],
  ["939", "Very Dark Navy Blue", 27, 40, 83],
  ["940", "Bright Aqua", 0, 0, 0],
  ["941", "Bright Neon Blue", 0, 0, 0],
  ["943", "Medium Aquamarine", 61, 147, 132],
  ["945", "Tawny", 251, 213, 187],
  ["946", "Medium Burnt Orange", 235, 99, 7],
  ["947", "Burnt Orange", 255, 123, 77],
  ["948", "Very Light Peach", 254, 231, 218],
  ["950", "Light Desert Sand", 238, 211, 196],
  ["951", "Light Tawny", 255, 226, 207],
  ["954", "Nile Green", 136, 186, 145],
  ["955", "Light Nile Green", 162, 214, 173],
  ["956", "Geranium", 255, 109, 115],
  ["957", "Pale Geranium", 253, 181, 181],
  ["958", "Dark Sea Green", 62, 182, 161],
  ["959", "Medium Sea Green", 89, 199, 180],
  ["961", "Dark Dusty Rose", 207, 115, 115],
  ["962", "Medium Dusty Rose", 230, 138, 138],
  ["963", "Ultra Very Light Dusty Rose", 255, 215, 215],
  ["964", "Light Sea Green", 169, 226, 216],
  ["966", "Medium Light Baby Green", 185, 215, 192],
  ["970", "Light Pumpkin", 247, 139, 19],
  ["971", "Pumpkin", 246, 127, 0],
  ["972", "Deep Canary", 255, 181, 21],
  ["973", "Bright Canary", 255, 227, 0],
  ["975", "Dark Golden Brown", 145, 79, 18],
  ["976", "Medium Golden Brown", 194, 129, 44],
  ["977", "Light Golden Brown", 220, 156, 86],
  ["986", "Very Dark Forest Green", 64, 82, 48],
  ["987", "Dark Forest Green", 88, 113, 65],
  ["988", "Medium Forest Green", 115, 139, 91],
  ["989", "Forest Green", 141, 166, 117],
  ["991", "Dark Aquamarine", 71, 123, 110],
  ["992", "Light Aquamarine", 111, 174, 159],
  ["993", "Very Light Aquamarine", 144, 192, 180],
  ["995", "Dark Electric Blue", 38, 150, 182],
  ["996", "Medium Electric Blue", 48, 194, 236],
  ["3011", "Dark Khaki Green", 137, 138, 88],
  ["3012", "Medium Khaki Green", 166, 167, 93],
  ["3013", "Light Khaki Green", 185, 185, 130],
  ["3021", "Very Dark Brown Gray", 79, 75, 65],
  ["3022", "Medium Brown Gray", 142, 144, 120],
  ["3023", "Light Brown Gray", 177, 170, 151],
  ["3024", "Very Light Brown Gray", 235, 234, 231],
  ["3031", "Very Dark Mocha Brown", 75, 60, 42],
  ["3032", "Medium Mocha Brown", 179, 159, 139],
  ["3033", "Very Light Mocha Brown", 227, 216, 204],
  ["3041", "Medium Antique Violet", 149, 111, 124],
  ["3042", "Light Antique Violet", 183, 157, 167],
  ["3045", "Dark Yellow Beige", 188, 150, 106],
  ["3046", "Medium Yellow Beige", 216, 188, 154],
  ["3047", "Light Yellow Beige", 231, 214, 193],
  ["3051", "Dark Green Gray", 95, 102, 72],
  ["3052", "Medium Green Gray", 136, 146, 104],
  ["3053", "Light Green Gray", 156, 164, 130],
  ["3064", "Desert Sand", 196, 142, 112],
  ["3072", "Very Light Beaver Gray", 230, 232, 232],
  ["3078", "Very Light Golden Yellow", 253, 249, 205],
  ["3325", "Light Baby Blue", 184, 210, 230],
  ["3326", "Light Rose", 251, 173, 180],
  ["3328", "Dark Salmon", 227, 109, 109],
  ["3340", "Medium Apricot", 255, 131, 111],
  ["3341", "Apricot", 252, 171, 152],
  ["3345", "Dark Hunter Green", 27, 89, 21],
  ["3346", "Hunter Green", 64, 106, 58],
  ["3347", "Medium Yellow Green", 113, 147, 92],
  ["3348", "Light Yellow Green", 204, 217, 177],
  ["3350", "Ultra Dark Dusty Rose", 188, 67, 101],
  ["3354", "Light Dusty Rose", 228, 166, 172],
  ["3362", "Dark Pine Green", 94, 107, 71],
  ["3363", "Medium Pine Green", 114, 130, 86],
  ["3364", "Pine Green", 131, 151, 95],
  ["3371", "Black Brown", 30, 17, 8],
  ["3607", "Light Plum", 197, 73, 137],
  ["3608", "Very Light Plum", 234, 156, 196],
  ["3609", "Ultra Light Plum", 244, 174, 213],
  ["3685", "Very Dark Mauve", 136, 21, 49],
  ["3687", "Mauve", 201, 107, 112],
  ["3688", "Medium Mauve", 231, 169, 172],
  ["3689", "Light Mauve", 251, 191, 194],
  ["3705", "Dark Melon", 255, 85, 91],
  ["3706", "Medium Melon", 255, 173, 188],
  ["3708", "Light Melon", 255, 203, 213],
  ["3712", "Medium Salmon", 241, 135, 135],
  ["3713", "Very Light Salmon", 255, 226, 226],
  ["3716", "Very Light Dusty Rose", 255, 189, 189],
  ["3721", "Dark Shell Pink", 161, 75, 81],
  ["3722", "Medium Shell Pink", 188, 108, 100],
  ["3726", "Dark Antique Mauve", 155, 91, 102],
  ["3727", "Light Antique Mauve", 219, 169, 178],
  ["3731", "Very Dark Dusty Rose", 218, 103, 131],
  ["3733", "Dusty Rose", 232, 135, 155],
  ["3740", "Dark Antique Violet", 120, 87, 98],
  ["3743", "Very Light Antique Violet", 215, 203, 211],
  ["3746", "Dark Blue Violet", 119, 107, 152],
  ["3747", "Very Light Blue Violet", 211, 215, 237],
  ["3750", "Very Dark Antique Blue", 56, 76, 94],
  ["3752", "Very Light Antique Blue", 199, 209, 219],
  ["3753", "Ultra Very Light Antique Blue", 219, 226, 233],
  ["3755", "Baby Blue", 147, 180, 206],
  ["3756", "Ultra Very Light Baby Blue", 238, 252, 252],
  ["3760", "Medium Wedgwood", 62, 133, 162],
  ["3761", "Light Sky Blue", 172, 216, 226],
  ["3765", "Very Dark Peacock Blue", 52, 127, 140],
  ["3766", "Light Peacock Blue", 153, 207, 217],
  ["3768", "Dark Gray Green", 101, 127, 127],
  ["3770", "Very Light Tawny", 255, 238, 227],
  ["3771", "Ultra Very Light Terra Cotta", 244, 187, 169],
  ["3772", "Very Dark Desert Sand", 160, 108, 80],
  ["3773", "Medium Desert Sand", 182, 117, 82],
  ["3774", "Very Light Desert Sand", 243, 225, 215],
  ["3776", "Light Mahogany", 207, 121, 57],
  ["3777", "Very Dark Terra Cotta", 134, 48, 34],
  ["3778", "Light Terra Cotta", 217, 137, 120],
  ["3779", "Ultra Very Light Terra Cotta", 248, 202, 200],
  ["3781", "Dark Mocha Brown", 107, 87, 67],
  ["3782", "Light Mocha Brown", 210, 188, 166],
  ["3787", "Dark Brown Gray", 98, 93, 80],
  ["3790", "Ultra Dark Beige Gray", 127, 106, 85],
  ["3799", "Very Dark Pewter Gray", 66, 66, 66],
  ["3801", "Very Dark Melon", 231, 73, 103],
  ["3802", "Very Dark Antique Mauve", 113, 65, 73],
  ["3803", "Dark Mauve", 171, 51, 87],
  ["3804", "Dark Cyclamen Pink", 224, 40, 118],
  ["3805", "Cyclamen Pink", 243, 71, 139],
  ["3806", "Light Cyclamen Pink", 255, 140, 174],
  ["3807", "Cornflower Blue", 96, 103, 140],
  ["3808", "Ultra Very Dark Turquoise", 54, 105, 112],
  ["3809", "Very Dark Turquoise", 63, 124, 133],
  ["3810", "Dark Turquoise", 72, 142, 154],
  ["3811", "Very Light Turquoise", 188, 227, 230],
  ["3812", "Very Dark Sea Green", 47, 140, 132],
  ["3813", "Light Blue Green", 178, 212, 189],
  ["3814", "Aquamarine", 80, 139, 125],
  ["3815", "Dark Celadon Green", 71, 119, 89],
  ["3816", "Celadon Green", 101, 165, 125],
  ["3817", "Light Celadon Green", 153, 195, 170],
  ["3818", "Ultra Very Dark Emerald Green", 17, 90, 59],
  ["3819", "Light Moss Green", 224, 232, 104],
  ["3820", "Dark Straw", 223, 182, 95],
  ["3821", "Straw", 243, 206, 117],
  ["3822", "Light Straw", 246, 220, 152],
  ["3823", "Ultra Pale Yellow", 255, 253, 227],
  ["3824", "Light Apricot", 254, 205, 194],
  ["3825", "Pale Pumpkin", 253, 189, 150],
  ["3826", "Golden Brown", 173, 114, 57],
  ["3827", "Pale Golden Brown", 247, 187, 119],
  ["3828", "Hazelnut Brown", 183, 139, 97],
  ["3829", "Very Dark Old Gold", 169, 130, 4],
  ["3830", "Terra Cotta", 185, 85, 68],
  ["3831", "Dark Raspberry", 179, 47, 72],
  ["3832", "Medium Raspberry", 219, 85, 110],
  ["3833", "Light Raspberry", 234, 134, 153],
  ["3834", "Dark Grape", 114, 55, 93],
  ["3835", "Medium Grape", 148, 96, 131],
  ["3836", "Light Grape", 186, 145, 170],
  ["3837", "Ultra Dark Lavender", 108, 58, 110],
  ["3838", "Dark Lavender Blue", 92, 114, 148],
  ["3839", "Medium Lavender Blue", 123, 142, 171],
  ["3840", "Light Lavender Blue", 176, 192, 218],
  ["3841", "Pale Baby Blue", 205, 223, 237],
  ["3842", "Dark Wedgwood", 50, 102, 124],
  ["3843", "Electric Blue", 20, 170, 208],
  ["3844", "Dark Bright Turquoise", 18, 174, 186],
  ["3845", "Medium Bright Turquoise", 4, 196, 202],
  ["3846", "Light Bright Turquoise", 6, 227, 230],
  ["3847", "Dark Teal Green", 52, 125, 117],
  ["3848", "Medium Teal Green", 85, 156, 145],
  ["3849", "Light Teal Green", 82, 179, 164],
  ["3850", "Dark Bright Green", 55, 132, 119],
  ["3851", "Light Bright Green", 73, 179, 161],
  ["3852", "Very Dark Straw", 205, 157, 55],
  ["3853", "Dark Autumn Gold", 242, 151, 70],
  ["3854", "Medium Autumn Gold", 242, 175, 104],
  ["3855", "Light Autumn Gold", 250, 211, 150],
  ["3856", "Ultra Very Light Mahogany", 255, 211, 181],
  ["3857", "Dark Rosewood", 104, 37, 26],
  ["3858", "Medium Rosewood", 150, 74, 63],
  ["3859", "Light Rosewood", 186, 139, 124],
  ["3860", "Cocoa", 125, 93, 87],
  ["3861", "Light Cocoa", 166, 136, 129],
  ["3862", "Dark Mocha Beige", 138, 110, 78],
  ["3863", "Medium Mocha Beige", 164, 131, 92],
  ["3864", "Light Mocha Beige", 203, 182, 156],
  ["3865", "Winter White", 249, 247, 241],
  ["3866", "Ultra Very Light Mocha Brown", 250, 246, 240],
];

// Build the full database with precomputed Lab values
export const DMC_COLORS: DmcColor[] = DMC_RAW
  .filter(([, , r, g, b]) => !(r === 0 && g === 0 && b === 0) || true) // keep all, even black
  .map(([dmc, name, r, g, b]) => ({
    dmc,
    name,
    hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
    r,
    g,
    b,
    lab: rgbToLab(r, g, b),
  }));

// Remove duplicate black entries (940, 941 are placeholder zeros)
const validColors = DMC_COLORS.filter(c => {
  if ((c.dmc === '940' || c.dmc === '941') && c.r === 0 && c.g === 0 && c.b === 0) return false;
  return true;
});

/**
 * Find the nearest DMC thread color to a given RGB value.
 * Uses CIE76 distance in Lab space for perceptual accuracy.
 */
export function findNearestDmc(r: number, g: number, b: number): DmcColor {
  const targetLab = rgbToLab(r, g, b);
  let bestMatch = validColors[0];
  let bestDist = Infinity;

  for (const color of validColors) {
    const dist = labDistance(targetLab, color.lab!);
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = color;
    }
  }

  return bestMatch;
}

/**
 * Remap a raw pixel buffer so every color is replaced with its nearest DMC match.
 * Returns the remapped buffer and a map of original hex -> DmcColor.
 */
export function remapBufferToDmc(
  data: Buffer,
  width: number,
  height: number,
  channels: number
): { remappedData: Buffer; colorMap: Map<string, DmcColor> } {
  const colorMap = new Map<string, DmcColor>();
  const remapped = Buffer.from(data); // copy

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

    let dmc: DmcColor;
    if (colorMap.has(hex)) {
      dmc = colorMap.get(hex)!;
    } else {
      dmc = findNearestDmc(r, g, b);
      colorMap.set(hex, dmc);
    }

    remapped[i] = dmc.r;
    remapped[i + 1] = dmc.g;
    remapped[i + 2] = dmc.b;
  }

  return { remappedData: remapped, colorMap };
}
