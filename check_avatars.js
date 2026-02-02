
const { Job, ResumeJob, User, sequelize } = require('./backend/models');

async function checkAvatars() {
  try {
    const jobs = await Job.findAll({
      attributes: [
        'id', 'title',
        [
          sequelize.literal(`(
            SELECT GROUP_CONCAT(avatar_sub.avatar)
            FROM (
              SELECT u.avatar
              FROM resume_jobs AS rj
              JOIN users AS u ON rj.user_id = u.id
              WHERE rj.job_id = Job.id AND u.avatar IS NOT NULL AND u.avatar != ''
              ORDER BY rj.applied_at DESC
              LIMIT 5
            ) AS avatar_sub
          )`),
          'candidate_avatars'
        ]
      ],
      limit: 5
    });

    console.log('Jobs with avatars data:');
    jobs.forEach(job => {
      console.log(`Job ID: ${job.id}, Title: ${job.title}, Avatars: ${job.get('candidate_avatars')}`);
    });

    // Also check if any users have avatars at all
    const { Op } = require('sequelize');
    const usersWithAvatars = await User.count({
      where: {
        avatar: { [Op.ne]: null }
      }
    });
    console.log(`Total users with avatars: ${usersWithAvatars}`);

    const resumeJobsCount = await ResumeJob.count();
    console.log(`Total resume_jobs entries: ${resumeJobsCount}`);

  } catch (error) {
    console.error('Error checking avatars:', error);
  } finally {
    process.exit();
  }
}

checkAvatars();
