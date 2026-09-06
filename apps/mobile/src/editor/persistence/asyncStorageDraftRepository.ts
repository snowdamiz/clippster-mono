import AsyncStorage from '@react-native-async-storage/async-storage';

import { LocalDraftRepository } from './draftRepository';

export const mobileDraftRepository = new LocalDraftRepository(AsyncStorage);
