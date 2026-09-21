import { useMemo } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { RawStatus, EditedStatus, SortDirection, ImageFile, GroupingMode } from '../components/ui/AppProperties';
import { buildImageGroups, GroupBadgeInfo, GroupId } from '../utils/imageGrouping';

export const ADVANCED_QUERY_REGEX =
  /^(iso|aperture|f|shutter|s|focal|mm|rating|color|camera|make|model|lens|edited|status|type|tag)\s*(?::)?\s*(>=|<=|>|<|=)?\s*(.+)$/i;

const parseShutter = (val: string | undefined): number => {
  if (!val) return 0;
  const cleanVal = val.replace(/s/i, '').trim();
  const parts = cleanVal.split('/');
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    return den !== 0 ? num / den : 0;
  }
  const numVal = parseFloat(cleanVal);
  return isNaN(numVal) ? 0 : numVal;
};

const parseAperture = (val: string | undefined): number => {
  if (!val) return 0;
  const match = val.match(/(\d+(\.\d+)?)/);
  const numVal = match ? parseFloat(match[0]) : 0;
  return isNaN(numVal) ? 0 : numVal;
};

const parseFocalLength = (val: string | undefined): number => {
  if (!val) return 0;
  const match = val.match(/(\d+(\.\d+)?)/);
  if (!match) return 0;
  const numVal = parseFloat(match[0]);
  return isNaN(numVal) ? 0 : numVal;
};

interface SmartSearchQuery {
  colors: string[];
  editedStatus: 'edited' | 'unedited' | null;
  focalLength: number | null;
  hasSignals: boolean;
  iso: { operator: string; value: number } | null;
  rating: { operator: string; value: number } | null;
  rawStatus: 'raw' | 'nonraw' | null;
  termGroups: string[][];
}

const SMART_COLOR_ALIASES: Record<string, string> = {
  red: 'red',
  '红': 'red',
  '红色': 'red',
  yellow: 'yellow',
  '黄': 'yellow',
  '黄色': 'yellow',
  green: 'green',
  '绿': 'green',
  '绿色': 'green',
  blue: 'blue',
  '蓝': 'blue',
  '蓝色': 'blue',
  purple: 'purple',
  '紫': 'purple',
  '紫色': 'purple',
  none: 'none',
  unlabeled: 'none',
  '无标签': 'none',
};

const SEMANTIC_SEARCH_ALIASES: Array<{ pattern: RegExp; terms: string[] }> = [
  { pattern: /(sunset|golden\s*hour|dusk|日落|夕阳|黄昏)/i, terms: ['sunset', 'dusk', 'orange', 'sky'] },
  { pattern: /(portrait|people|person|face|人像|人物|肖像)/i, terms: ['portrait', 'person', 'people', 'face', 'human'] },
  { pattern: /(landscape|nature|scenery|风景|风光|自然)/i, terms: ['landscape', 'nature', 'mountain', 'forest', 'sky', 'water'] },
  { pattern: /(night|nightscape|夜景|夜晚|暗光)/i, terms: ['night', 'dark', 'city', 'low light'] },
  { pattern: /(sky|cloud|天空|云)/i, terms: ['sky', 'cloud'] },
  { pattern: /(food|meal|美食|食物|餐)/i, terms: ['food', 'meal'] },
  { pattern: /(street|城市|街拍|街道)/i, terms: ['street', 'city', 'urban'] },
];

const compareNumber = (imgVal: number, operator: string, qVal: number) => {
  switch (operator) {
    case '>':
      return imgVal > qVal;
    case '<':
      return imgVal < qVal;
    case '>=':
      return imgVal >= qVal;
    case '<=':
      return imgVal <= qVal;
    case '=':
    case ':':
    default:
      return imgVal === qVal;
  }
};

const parseSmartSearchText = (text: string): SmartSearchQuery => {
  let rest = text.toLowerCase();
  const query: SmartSearchQuery = {
    colors: [],
    editedStatus: null,
    focalLength: null,
    hasSignals: false,
    iso: null,
    rating: null,
    rawStatus: null,
    termGroups: [],
  };

  const explicitRatingMatch = rest.match(/(?:rating|评分|星级)\s*(>=|<=|>|<|=)?\s*([1-5])/);
  const starRatingMatch = !explicitRatingMatch
    ? rest.match(/([1-5])\s*(?:star|stars|星|★)(?:\s*(以上|up|\+))?/)
    : null;
  const ratingMatch = explicitRatingMatch || starRatingMatch;
  if (ratingMatch) {
    const value = explicitRatingMatch ? Number(explicitRatingMatch[2]) : Number(starRatingMatch?.[1]);
    const operator = explicitRatingMatch?.[1] || '>=';
    query.rating = { operator, value };
    query.hasSignals = true;
    rest = rest.replace(ratingMatch[0], ' ');
  }

  const isoMatch = rest.match(/iso\s*(>=|<=|>|<|=)?\s*(\d{2,6})/);
  if (isoMatch) {
    query.iso = { operator: isoMatch[1] || '=', value: Number(isoMatch[2]) };
    query.hasSignals = true;
    rest = rest.replace(isoMatch[0], ' ');
  }

  const focalMatch = rest.match(/(\d{1,4})\s*mm/);
  if (focalMatch) {
    query.focalLength = Number(focalMatch[1]);
    query.hasSignals = true;
    rest = rest.replace(focalMatch[0], ' ');
  }

  if (/(unedited|not edited|未修|未编辑|未調整|未調色)/i.test(rest)) {
    query.editedStatus = 'unedited';
    query.hasSignals = true;
    rest = rest.replace(/unedited|not edited|未修|未编辑|未調整|未調色/gi, ' ');
  } else if (/(edited|已修|已编辑|已調整|已調色)/i.test(rest)) {
    query.editedStatus = 'edited';
    query.hasSignals = true;
    rest = rest.replace(/edited|已修|已编辑|已調整|已調色/gi, ' ');
  }

  if (/(raw|原片|原始)/i.test(rest)) {
    query.rawStatus = 'raw';
    query.hasSignals = true;
    rest = rest.replace(/raw|原片|原始/gi, ' ');
  } else if (/(jpeg|jpg|png|tiff|非raw|成片)/i.test(rest)) {
    query.rawStatus = 'nonraw';
    query.hasSignals = true;
    rest = rest.replace(/jpeg|jpg|png|tiff|非raw|成片/gi, ' ');
  }

  for (const [alias, color] of Object.entries(SMART_COLOR_ALIASES)) {
    const pattern = new RegExp(`(^|\\s)${alias}(\\s|$)`, 'i');
    if (pattern.test(rest)) {
      query.colors.push(color);
      query.hasSignals = true;
      rest = rest.replace(pattern, ' ');
    }
  }

  for (const alias of SEMANTIC_SEARCH_ALIASES) {
    if (alias.pattern.test(rest)) {
      query.termGroups.push(alias.terms);
      query.hasSignals = true;
      rest = rest.replace(alias.pattern, ' ');
    }
  }

  const stopWords = new Set(['and', 'or', 'with', 'photos', 'photo', 'images', 'image', '照片', '图片', '影像', '的']);
  const remainingTerms = rest
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1 && !stopWords.has(term));

  for (const term of remainingTerms) {
    query.termGroups.push([term]);
  }

  return query;
};

const evaluateSmartSearchQuery = (
  query: SmartSearchQuery,
  image: ImageFile,
  imageRatings: Record<string, number>,
) => {
  if (query.rating) {
    const rating = imageRatings[image.path] || 0;
    if (!compareNumber(rating, query.rating.operator, query.rating.value)) return false;
  }

  if (query.iso) {
    const iso = parseInt(image.exif?.PhotographicSensitivity || image.exif?.ISOSpeedRatings || '0', 10) || 0;
    if (!compareNumber(iso, query.iso.operator, query.iso.value)) return false;
  }

  if (query.focalLength !== null) {
    const focal = parseFocalLength(image.exif?.FocalLength);
    if (Math.abs(focal - query.focalLength) > 0.8) return false;
  }

  if (query.editedStatus === 'edited' && !image.is_edited) return false;
  if (query.editedStatus === 'unedited' && image.is_edited) return false;

  if (query.rawStatus) {
    if (query.rawStatus === 'raw' && !image.is_raw) return false;
    if (query.rawStatus === 'nonraw' && image.is_raw) return false;
  }

  if (query.colors.length > 0) {
    const imageColor = (image.tags || []).find((tag: string) => tag.startsWith('color:'))?.substring(6) || 'none';
    if (!query.colors.includes(imageColor)) return false;
  }

  if (query.termGroups.length > 0) {
    const lowerCaseImageTags = (image.tags || []).map((t) => t.toLowerCase().replace('user:', '').replace('color:', ''));
    const filename = image?.path?.split(/[\\/]/)?.pop()?.toLowerCase() || '';
    const haystack = [filename, ...lowerCaseImageTags];
    return query.termGroups.every((group) => group.some((term) => haystack.some((item) => item.includes(term))));
  }

  return true;
};

export interface GroupedLibrary {
  displayList: ImageFile[];
  badges: Map<GroupId, GroupBadgeInfo> | null;
}

function computeGroupedLibrary(libraryState: any, settingsState: any): GroupedLibrary {
  const { imageList, imageRatings, filterCriteria, searchCriteria, sortCriteria } = libraryState;
  const { appSettings } = settingsState;

  const groupingMode: GroupingMode = appSettings?.grouping ?? 'off';
  const isGroupingActive = groupingMode !== 'off';

  const matchesFilter = (image: ImageFile): boolean => {
    if (filterCriteria.rating !== 0) {
      const rating = imageRatings[image.path] || 0;
      if (filterCriteria.rating === -1 && rating !== 0) return false;
      if (filterCriteria.rating === 5 && rating !== 5) return false;
      if (filterCriteria.rating > 0 && filterCriteria.rating < 5 && rating < filterCriteria.rating) return false;
    }

    if (filterCriteria.rawStatus && filterCriteria.rawStatus !== RawStatus.All) {
      if (filterCriteria.rawStatus === RawStatus.RawOnly && !image.is_raw) return false;
      if (filterCriteria.rawStatus === RawStatus.NonRawOnly && image.is_raw) return false;
    }

    if (filterCriteria.editedStatus && filterCriteria.editedStatus !== EditedStatus.All) {
      if (filterCriteria.editedStatus === EditedStatus.EditedOnly && !image.is_edited) return false;
      if (filterCriteria.editedStatus === EditedStatus.UneditedOnly && image.is_edited) return false;
    }

    if (filterCriteria.colors && filterCriteria.colors.length > 0) {
      const imageColor = (image.tags || []).find((tag: string) => tag.startsWith('color:'))?.substring(6);
      const hasMatchingColor = imageColor && filterCriteria.colors.includes(imageColor);
      const matchesNone = !imageColor && filterCriteria.colors.includes('none');

      if (!hasMatchingColor && !matchesNone) return false;
    }

    return true;
  };

  const { tags: searchTags, text: searchText, mode: searchMode } = searchCriteria;
  const lowerCaseSearchText = searchText.trim().toLowerCase();
  const smartSearchQuery = parseSmartSearchText(lowerCaseSearchText);

  const parsedTags = searchTags.map((tag: string) => {
    const match = tag.match(ADVANCED_QUERY_REGEX);
    if (match) {
      const operator = match[2] || '=';
      return { type: 'query', field: match[1].toLowerCase(), operator, value: match[3].toLowerCase(), raw: tag };
    }
    return { type: 'normal', value: tag.toLowerCase(), raw: tag };
  });

  const evaluateQuery = (q: any, image: ImageFile) => {
    const { field, operator, value } = q;

    if (['iso', 'aperture', 'f', 'shutter', 's', 'focal', 'mm', 'rating'].includes(field)) {
      let imgVal = 0;
      let qVal = parseFloat(value);

      if (field === 'iso')
        imgVal = parseInt(image.exif?.PhotographicSensitivity || image.exif?.ISOSpeedRatings || '0', 10) || 0;
      else if (field === 'aperture' || field === 'f') imgVal = parseAperture(image.exif?.FNumber);
      else if (field === 'focal' || field === 'mm') imgVal = parseFocalLength(image.exif?.FocalLength);
      else if (field === 'rating') imgVal = imageRatings[image.path] || 0;
      else if (field === 'shutter' || field === 's') {
        imgVal = parseShutter(image.exif?.ExposureTime);
        qVal = parseShutter(value);
      }

      switch (operator) {
        case '>':
          return imgVal > qVal;
        case '<':
          return imgVal < qVal;
        case '>=':
          return imgVal >= qVal;
        case '<=':
          return imgVal <= qVal;
        case '=':
        case ':':
          return imgVal === qVal;
        default:
          return false;
      }
    } else {
      let imgStr = '';
      if (field === 'camera' || field === 'make' || field === 'model') {
        imgStr = `${image.exif?.Make || ''} ${image.exif?.Model || ''}`.toLowerCase();
      } else if (field === 'lens') {
        imgStr = String(
          `${image.exif?.LensModel || ''} ${image.exif?.Lens || ''} ${image.exif?.LensMake || ''}`,
        ).toLowerCase();
      } else if (field === 'color') {
        imgStr = (image.tags || []).find((t: string) => t.startsWith('color:'))?.substring(6) || '';
      } else if (field === 'tag') {
        imgStr = (image.tags || []).map((t: string) => t.replace('user:', '').replace('color:', '')).join(' ').toLowerCase();
      } else if (field === 'edited' || field === 'status') {
        const wantsEdited = ['true', 'yes', 'edited', '已修', '已编辑'].includes(value);
        const wantsUnedited = ['false', 'no', 'unedited', '未修', '未编辑'].includes(value);
        if (wantsEdited) return !!image.is_edited;
        if (wantsUnedited) return !image.is_edited;
        imgStr = image.is_edited ? 'edited' : 'unedited';
      } else if (field === 'type') {
        const extension = image.path.split('?vc=')[0].split('.').pop()?.toLowerCase() || '';
        imgStr = image.is_raw ? 'raw' : extension;
      }

      return operator === '=' || operator === ':' ? imgStr.includes(value) : false;
    }
  };

  const isSearchActive = parsedTags.length > 0 || lowerCaseSearchText !== '';

  const matchesSearch = (image: ImageFile): boolean => {
    if (!isSearchActive) return true;

    const lowerCaseImageTags = (image.tags || []).map((t) => t.toLowerCase().replace('user:', ''));
    const filename = image?.path?.split(/[\\/]/)?.pop()?.toLowerCase() || '';

    let tagsMatch = true;
    if (parsedTags.length > 0) {
      const evaluateTag = (parsedTag: any) => {
        if (parsedTag.type === 'normal') {
          return lowerCaseImageTags.some((imgTag) => imgTag.includes(parsedTag.value));
        }
        return evaluateQuery(parsedTag, image);
      };

      if (searchMode === 'OR') {
        tagsMatch = parsedTags.some((pt: any) => evaluateTag(pt));
      } else {
        tagsMatch = parsedTags.every((pt: any) => evaluateTag(pt));
      }
    }

    let textMatch = true;
    if (lowerCaseSearchText !== '') {
      const plainTextMatch =
        filename.includes(lowerCaseSearchText) || lowerCaseImageTags.some((t) => t.includes(lowerCaseSearchText));
      textMatch = smartSearchQuery.hasSignals
        ? evaluateSmartSearchQuery(smartSearchQuery, image, imageRatings) || plainTextMatch
        : plainTextMatch;
    }

    return tagsMatch && textMatch;
  };

  let processedList = imageList;
  let searchMatchingGroupIds: Set<string> | null = null;

  if (isGroupingActive) {
    const groupEditedFiles = appSettings?.groupEditedFiles ?? true;
    const groupingResult = buildImageGroups(imageList, groupingMode, groupEditedFiles);
    processedList = groupingResult.displayList;

    if (isSearchActive) {
      searchMatchingGroupIds = new Set<string>();
      for (const image of imageList) {
        if (!image.group_id) continue;
        if (matchesSearch(image)) {
          searchMatchingGroupIds.add(image.group_id);
        }
      }
    }
  }

  const filteredList = processedList.filter((image: ImageFile) => matchesFilter(image));

  const filteredBySearch = !isSearchActive
    ? filteredList
    : filteredList.filter((image: ImageFile) => {
        if (searchMatchingGroupIds && image.group_id && searchMatchingGroupIds.has(image.group_id)) return true;
        return matchesSearch(image);
      });

  const list = [...filteredBySearch];

  list.sort((a, b) => {
    const { key, order } = sortCriteria;
    let comparison = 0;

    switch (key) {
      case 'date_taken': {
        const dateA = a.exif?.DateTimeOriginal || '';
        const dateB = b.exif?.DateTimeOriginal || '';
        if (dateA !== dateB) comparison = dateA < dateB ? -1 : 1;
        else comparison = a.modified - b.modified;
        break;
      }
      case 'iso': {
        const isoA = parseInt(a.exif?.PhotographicSensitivity || a.exif?.ISOSpeedRatings || '0', 10) || 0;
        const isoB = parseInt(b.exif?.PhotographicSensitivity || b.exif?.ISOSpeedRatings || '0', 10) || 0;
        comparison = isoA - isoB;
        break;
      }
      case 'shutter_speed': {
        comparison = parseShutter(a.exif?.ExposureTime) - parseShutter(b.exif?.ExposureTime);
        break;
      }
      case 'aperture': {
        comparison = parseAperture(a.exif?.FNumber) - parseAperture(b.exif?.FNumber);
        break;
      }
      case 'focal_length': {
        comparison = parseFocalLength(a.exif?.FocalLength) - parseFocalLength(b.exif?.FocalLength);
        break;
      }
      case 'date':
        comparison = a.modified - b.modified;
        break;
      case 'rating':
        comparison = (imageRatings[a.path] || 0) - (imageRatings[b.path] || 0);
        break;
      case 'edited':
        comparison = a.is_edited === b.is_edited ? 0 : a.is_edited ? 1 : -1;
        break;
      default: {
        const nameA = a.path.split(/[\\/]/).pop() || a.path;
        const nameB = b.path.split(/[\\/]/).pop() || b.path;
        comparison = nameA.localeCompare(nameB);
        break;
      }
    }

    if (comparison === 0 && key !== 'name') {
      const nameA = a.path.split(/[\\/]/).pop() || a.path;
      const nameB = b.path.split(/[\\/]/).pop() || b.path;
      return nameA.localeCompare(nameB);
    }

    return order === SortDirection.Ascending ? comparison : -comparison;
  });

  const badges = isGroupingActive
    ? buildImageGroups(imageList, groupingMode, appSettings?.groupEditedFiles ?? true).badges
    : null;

  return { displayList: list, badges };
}

export function computeSortedLibrary(libraryState: any, settingsState: any): ImageFile[] {
  return computeGroupedLibrary(libraryState, settingsState).displayList;
}

export function useSortedLibrary() {
  const imageList = useLibraryStore((state) => state.imageList);
  const imageRatings = useLibraryStore((state) => state.imageRatings);
  const filterCriteria = useLibraryStore((state) => state.filterCriteria);
  const searchCriteria = useLibraryStore((state) => state.searchCriteria);
  const sortCriteria = useLibraryStore((state) => state.sortCriteria);

  const appSettings = useSettingsStore((state) => state.appSettings);

  const result = useMemo(() => {
    return computeGroupedLibrary(
      { imageList, imageRatings, filterCriteria, searchCriteria, sortCriteria },
      { appSettings },
    );
  }, [imageList, sortCriteria, imageRatings, filterCriteria, searchCriteria, appSettings]);

  return result;
}
