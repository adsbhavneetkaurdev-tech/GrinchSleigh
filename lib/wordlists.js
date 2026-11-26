'use strict';
// Word lists for the moderation filter. All lowercase.
// Add event-specific names (staff, family, guests) in config/event.json -> moderation.extraBlockedNames.

// Whole-word profanity (matched after leetspeak/diacritic normalisation).
const PROFANITY = [
  'arse', 'arsehole', 'ass', 'asses', 'asshole', 'assholes', 'asshat', 'bastard', 'bastards',
  'bitch', 'bitches', 'bitchy', 'bloody', 'bollocks', 'bollock', 'boob', 'boobs',
  'bugger', 'bullshit', 'butthole', 'cock', 'cocks', 'crap', 'crappy', 'cunt', 'cunts',
  'damn', 'dammit', 'dick', 'dicks', 'dickhead', 'dildo', 'douche', 'douchebag', 'dyke',
  'fag', 'fags', 'faggot', 'fanny', 'feck', 'fuck', 'fucked', 'fucker', 'fuckers', 'fucking',
  'fuk', 'fck', 'fcuk', 'goddamn', 'hell', 'hoe', 'horny', 'jackass', 'jerkoff', 'jizz',
  'knobhead', 'kike', 'milf', 'minge', 'motherfucker', 'nazi', 'nigga', 'nigger',
  'nonce', 'paki', 'penis', 'piss', 'pissed', 'pissing', 'poof', 'porn',
  'prick', 'pricks', 'pussy', 'puta', 'retard', 'retarded', 'scrote', 'scumbag', 'sex', 'sexy',
  'shag', 'shit', 'shits', 'shitty', 'shite', 'skank', 'slag', 'slut', 'sluts', 'spaz', 'spic',
  'stfu', 'tits', 'titties', 'tosser', 'turd', 'twat', 'twats', 'vagina', 'wank',
  'wanker', 'wankers', 'whore', 'whores', 'wtf', 'wop'
];

// Roots that are caught even inside longer words ("fuckwit", "shithead").
// Only unambiguous roots belong here, to avoid the "Scunthorpe problem".
const PROFANITY_ROOTS = [
  'fuck', 'shit', 'cunt', 'bitch', 'wank', 'twat', 'nigg', 'fagg', 'whore', 'motherf',
  'bollock', 'dickhead', 'asshole', 'arsehole', 'bullshit', 'jackass', 'douche'
];

// Common first names and nicknames (UK/US/IE/AU plus frequent international names).
const FIRST_NAMES = [
  'aaron', 'abby', 'abigail', 'adam', 'adrian', 'aidan', 'aiden', 'aisha', 'alan', 'albert',
  'alex', 'alexa', 'alexander', 'alexandra', 'alexis', 'alfie', 'ali', 'alice', 'alicia', 'alison',
  'allison', 'amanda', 'amelia', 'amir', 'amy', 'andrea', 'andrew', 'andy', 'angela', 'angie',
  'anita', 'ann', 'anna', 'anne', 'annie', 'anthony', 'antonio', 'archie', 'arthur', 'ashley',
  'aubrey', 'audrey', 'austin', 'ava', 'barbara', 'barry', 'becky', 'bella', 'ben', 'benjamin',
  'benny', 'bernard', 'beth', 'bethany', 'betty', 'beverly', 'billy', 'bob', 'bobby', 'brad',
  'bradley', 'brandon', 'brenda', 'brendan', 'brian', 'bridget', 'brittany', 'bruce', 'bryan',
  'caitlin', 'callum', 'cameron', 'carl', 'carla', 'carlos', 'carmen', 'caroline', 'carolyn',
  'catherine', 'cathy', 'charles', 'charlie', 'charlotte', 'chelsea', 'cheryl', 'chloe', 'chris',
  'christian', 'christina', 'christine', 'christopher', 'ciara', 'claire', 'clara',
  'colin', 'connor', 'conor', 'craig', 'cynthia', 'daisy', 'dan', 'dana', 'daniel', 'daniela',
  'danielle', 'danny', 'darren', 'dave', 'david', 'debbie', 'deborah', 'debra', 'declan', 'denise',
  'dennis', 'derek', 'diana', 'diane', 'dominic', 'donald', 'donna', 'doris', 'dorothy', 'doug',
  'douglas', 'dylan', 'eddie', 'edward', 'eileen', 'elaine', 'eleanor', 'elena', 'eli', 'elijah',
  'elizabeth', 'ella', 'ellie', 'ellen', 'emily', 'emma', 'eric', 'erica', 'erin', 'ethan',
  'eugene', 'evan', 'evelyn', 'fatima', 'fiona', 'florence', 'francesca', 'francis', 'fred',
  'freddie', 'frederick', 'freya', 'gabriel', 'gabriella', 'gareth', 'gary', 'gavin', 'gemma',
  'george', 'georgia', 'gerald', 'gill', 'gillian', 'gina', 'gloria', 'gordon', 'graham', 'greg',
  'gregory', 'hannah', 'harold', 'harriet', 'harry', 'harvey', 'hayley', 'heather', 'helen',
  'henry', 'holly', 'howard', 'hugh', 'hugo', 'ian', 'imogen', 'isaac', 'isabel', 'isabella',
  'isla', 'jackie', 'jacob', 'jake', 'james', 'jamie', 'jane', 'janet', 'janice',
  'jason', 'jasmine', 'jeff', 'jeffrey', 'jen', 'jenny', 'jennifer', 'jeremy', 'jerry',
  'jess', 'jessica', 'jill', 'jim', 'jimmy', 'joan', 'joanna', 'joanne', 'jodie', 'joe', 'joel',
  'joey', 'john', 'johnny', 'jon', 'jonathan', 'jordan', 'jose', 'joseph', 'josh', 'joshua',
  'joyce', 'juan', 'judith', 'judy', 'julia', 'julian', 'julie', 'justin', 'karen', 'kate',
  'katherine', 'kathleen', 'kathy', 'katie', 'kayla', 'keith', 'kelly', 'ken', 'kenneth', 'kerry',
  'kevin', 'kieran', 'kim', 'kimberly', 'kirsty', 'kyle', 'larry', 'laura', 'lauren', 'leah',
  'lee', 'leo', 'leon', 'liam', 'lily', 'linda', 'lindsay', 'lisa', 'liz', 'lizzie', 'logan',
  'lois', 'lola', 'louis', 'louise', 'lucas', 'lucy', 'luis', 'luke', 'lynn', 'maddie', 'madison',
  'maggie', 'mandy', 'margaret', 'maria', 'marie', 'marion', 'martin', 'mary', 'mason', 'matt',
  'matthew', 'maureen', 'megan', 'mel', 'melanie', 'melissa', 'mia', 'michael', 'michelle',
  'mick', 'mike', 'millie', 'mohammed', 'mohammad', 'muhammad', 'molly', 'monica', 'nancy',
  'naomi', 'natalie', 'nathan', 'neil', 'niamh', 'nicholas', 'nicky', 'nicola', 'nicole',
  'nigel', 'noah', 'nora', 'oliver', 'olivia', 'oscar', 'owen', 'pamela', 'paul', 'paula',
  'pauline', 'peter', 'phil', 'philip', 'phillip', 'phoebe', 'poppy', 'rachel', 'ralph',
  'rebecca', 'richard', 'rick', 'ricky', 'robert', 'roberto', 'robbie', 'roger', 'ronald',
  'ronnie', 'rory', 'rosie', 'ross', 'roy', 'russell', 'ruth', 'ryan', 'sally', 'sam', 'samantha',
  'samuel', 'sandra', 'sara', 'sarah', 'scott', 'sean', 'shane', 'sharon', 'shaun', 'sheila',
  'shirley', 'simon', 'sofia', 'sophia', 'sophie', 'stacey', 'stanley', 'stephanie', 'stephen',
  'steve', 'steven', 'stuart', 'susan', 'suzanne', 'tammy', 'tara', 'ted', 'teresa', 'terry',
  'theo', 'theresa', 'thomas', 'tim', 'timothy', 'tina', 'toby', 'tom', 'tommy', 'tony', 'tracy',
  'tracey', 'trevor', 'tyler', 'valerie', 'vanessa', 'victor', 'victoria', 'vincent', 'virginia',
  'walter', 'wayne', 'wendy', 'william', 'willie', 'zac', 'zach', 'zachary', 'zara', 'zoe'
];

// Names that are also everyday words. These are only flagged when written with a capital
// letter in the middle of a sentence ("my boss Frank", but not "be frank").
const AMBIGUOUS_NAMES = [
  'al', 'amber', 'jack', 'chuck', 'jean', 'jade', 'angel', 'april', 'art', 'autumn', 'bill', 'brook', 'buck', 'candy', 'chase',
  'cliff', 'crystal', 'dale', 'dawn', 'destiny', 'dean', 'don', 'drew', 'dusty', 'ed', 'faith',
  'frank', 'gene', 'ginger', 'glen', 'grace', 'grant', 'guy', 'hope', 'hunter', 'iris', 'jay',
  'jo', 'joy', 'june', 'king', 'lance', 'mark', 'max', 'may', 'melody', 'miles', 'nick', 'olive',
  'pat', 'patience', 'pearl', 'penny', 'ray', 'reed', 'rich', 'rob', 'robin', 'rocky', 'rose',
  'ruby', 'rusty', 'sandy', 'skye', 'sky', 'stew', 'sue', 'summer', 'sunny', 'taylor', 'violet',
  'wade', 'will', 'winter'
];

module.exports = { PROFANITY, PROFANITY_ROOTS, FIRST_NAMES, AMBIGUOUS_NAMES };
