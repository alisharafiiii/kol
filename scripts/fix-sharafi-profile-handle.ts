import { ProfileService } from '../lib/services/profile-service';
import { UnifiedProfile } from '../lib/types/profile';

async function fixSharafiProfile() {
  try {
    console.log('🔍 Checking sharafi_eth profile...\n');
    
    // Get all profiles
    const profiles = await ProfileService.searchProfiles({});
    
    console.log('Total profiles:', profiles.length);
    
    // Find profiles that might be sharafi
    const sharafiProfiles = profiles.filter((p: UnifiedProfile) => 
      p.twitterHandle === 'sharafi_eth' || 
      p.name === 'nabu.base.eth' ||
      p.id === 'user_sharafi_eth' ||
      p.id === 'twitter_sharafi_eth'
    );
    
    console.log('\nFound potential sharafi profiles:', sharafiProfiles.length);
    
    for (const profile of sharafiProfiles) {
      console.log('\nProfile:', {
        id: profile.id,
        twitterHandle: profile.twitterHandle,
        name: profile.name,
        role: profile.role,
        approvalStatus: profile.approvalStatus
      });
    }
    
    // Find the correct profile
    const correctProfile = sharafiProfiles.find((p: UnifiedProfile) => p.id === 'user_sharafi_eth');
    
    if (correctProfile) {
      console.log('\n🔧 Updating profile...');
      
      // Make sure the Twitter handle is correct
      correctProfile.twitterHandle = 'sharafi_eth';
      correctProfile.role = 'admin';
      correctProfile.approvalStatus = 'approved';
      
      // Save the updated profile
      await ProfileService.saveProfile(correctProfile);
      
      console.log('✅ Profile updated successfully!');
    } else {
      console.log('\n❌ Could not find user_sharafi_eth profile');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixSharafiProfile(); 